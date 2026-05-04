"""Material calculator endpoint.

Loads the reference data (product_yields + calculator_configs) on request
and runs the math. The data is small enough (~24 rows + 5 rows) that we
just fetch on every request — Supabase caches at the network layer and
this gives us a "no restart needed" workflow when prices change.
"""

from fastapi import APIRouter, Depends, HTTPException

from app.auth import AuthUser, require_permission, verify_jwt
from app.db import get_supabase
from app.services.calculator import (
    CalcInput,
    CalcResult,
    build_catalog,
    calculate,
    strip_prices,
)
from app.services.permissions import get_user_permissions

router = APIRouter(
    prefix="/calculator",
    tags=["Calculator"],
    dependencies=[Depends(verify_jwt)],
)


@router.post("/estimate", response_model=CalcResult)
def estimate(
    input: CalcInput,
    user: AuthUser = Depends(require_permission("can_use_calculator")),
) -> CalcResult:
    """Run the calculator. Returns sections + summary. Strips prices for
    users who lack `can_see_prices`."""
    sb = get_supabase()

    yield_rows = sb.table("product_yields").select("*").execute().data or []
    config_rows = sb.table("calculator_configs").select("*").execute().data or []

    if not yield_rows or not config_rows:
        raise HTTPException(
            status_code=500,
            detail="Calculator reference data missing — run migration 008.",
        )

    catalog = build_catalog(yield_rows, config_rows)
    try:
        result = calculate(input, catalog)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    perms = get_user_permissions(user.user_id)
    if not perms.can_see_prices:
        result = strip_prices(result)
    return result


@router.get("/options")
def options() -> dict:
    """
    Returns the dropdown options the form needs: finishes, sealers, fabric sizes.
    Lets the UI stay in sync with whatever's seeded without hardcoding lists.
    """
    sb = get_supabase()

    configs = (
        sb.table("calculator_configs")
        .select("finish_type, display_name, sort_order")
        .order("sort_order")
        .execute()
        .data
        or []
    )
    yields = (
        sb.table("product_yields")
        .select("product_name, sku_size, product_category")
        .execute()
        .data
        or []
    )

    sealer_categories = {
        "matte_sealer": "Matte Sealer",
        "titan_shield": "Titan Shield",
        "satin_stone": "Satin Stone",
        "natural_shield": "Natural Shield",
    }
    available_sealers = sorted({
        y["product_category"] for y in yields
        if y["product_category"] in sealer_categories
    })

    fabric_sizes = sorted({
        y["sku_size"] for y in yields if y["product_category"] == "fabric"
    })

    return {
        "finishes": [
            {"value": c["finish_type"], "label": c["display_name"]} for c in configs
        ],
        "sealers": [
            {"value": k, "label": sealer_categories[k]} for k in available_sealers
        ],
        "fabric_sizes": fabric_sizes,
    }
