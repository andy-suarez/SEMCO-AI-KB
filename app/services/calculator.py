"""Material calculator math.

Pure Python — no I/O, no DB, no HTTP. Takes the spreadsheet's reference
data (loaded once by the router) and a CalcInput, returns a CalcResult
with line items grouped by section + a summary block.

Pack optimization rule: fill the demand with as many large packs as
fully fit by coverage, then top up with small packs by ceil. Works
even when 5GL coverage isn't exactly 5×(1GL) — e.g., Microbond's
1GL = 200 sq ft but 5GL = 900 sq ft (a 5GL pack is one item, not
five). The optimizer minimizes item count without overshooting price.
"""

from __future__ import annotations

import math
from typing import Dict, List, Optional, Tuple

from pydantic import BaseModel, Field


# ---------- input / output shapes ----------------------------------------------

FinishType = str  # 'corsa' | 'polished' | 'vellum' | 'solid' | 'grain'
SealerKey = str   # 'matte_sealer' | 'titan_shield' | 'satin_stone' | 'natural_shield' | 'none'
FabricSize = str  # '6x75' | '29.5x100'


class BrownCoatInput(BaseModel):
    length_ft: float = Field(..., gt=0)
    width_ft: float = Field(..., gt=0)
    thickness_in: float = Field(..., gt=0, description="Decimal inches (e.g. 0.125 for 1/8\")")


class CalcInput(BaseModel):
    sqft: float = Field(..., gt=0, description="Total project square footage")
    finish_type: FinishType = Field(..., description="corsa_polished, vellum_solid, or grain")
    sealer: SealerKey = Field(default="none", description="Sealer choice or 'none'")
    use_slm: bool = Field(default=False, description="Apply SEMCO Liquid Membrane")
    fabric_size: Optional[FabricSize] = Field(default=None)
    fabric_qty: int = Field(default=0, ge=0)
    brown_coat: Optional[BrownCoatInput] = Field(
        default=None, description="If present, adds a Brown Coat section to the estimate"
    )


class LineItem(BaseModel):
    product_name: str
    sku_size: str
    qty: int
    weight_lbs: Optional[float] = None
    line_weight_lbs: Optional[float] = None
    unit_price_retail: Optional[float] = None
    line_total_retail: Optional[float] = None
    unit_price_wholesale: Optional[float] = None
    line_total_wholesale: Optional[float] = None
    notes: Optional[str] = None


class Section(BaseModel):
    name: str
    items: List[LineItem]


class Summary(BaseModel):
    item_count: int
    total_weight_lbs: float
    subtotal_retail: Optional[float] = None
    subtotal_wholesale: Optional[float] = None
    cost_per_sqft_retail: Optional[float] = None


class CalcResult(BaseModel):
    input: CalcInput
    finish_group: str
    sections: List[Section]
    summary: Summary
    prices_visible: bool = True


# ---------- internal product-row shape -----------------------------------------

class Yield(BaseModel):
    """A single product_yields row, in the shape the math wants."""

    product_name: str
    sku_size: str
    weight_lbs: Optional[float]
    price_retail: float
    price_wholesale: Optional[float]
    coverage_sqft_per_unit: Optional[float]
    finish_group: str
    product_category: str
    pack_size: str  # 'small' | 'large'


# Maps logical lookup keys to the catalog. Built by the router from DB rows.
class Catalog(BaseModel):
    yields_by_key: Dict[str, Yield] = Field(default_factory=dict)
    finish_to_group: Dict[str, str] = Field(default_factory=dict)
    finish_requires_microbond: Dict[str, bool] = Field(default_factory=dict)
    finish_requires_prestain: Dict[str, bool] = Field(default_factory=dict)


def _key(category: str, finish_group: str, pack_size: str) -> str:
    return f"{category}|{finish_group}|{pack_size}"


def build_catalog(
    yield_rows: List[dict],
    config_rows: List[dict],
) -> Catalog:
    """Convert raw DB rows into the lookup shape the calculator wants."""
    cat = Catalog()
    for row in yield_rows:
        y = Yield(
            product_name=row["product_name"],
            sku_size=row["sku_size"],
            weight_lbs=row.get("weight_lbs"),
            price_retail=float(row["price_retail"]),
            price_wholesale=row.get("price_wholesale"),
            coverage_sqft_per_unit=row.get("coverage_sqft_per_unit"),
            finish_group=row["finish_group"],
            product_category=row["product_category"],
            pack_size=row["pack_size"],
        )
        cat.yields_by_key[_key(y.product_category, y.finish_group, y.pack_size)] = y

    for row in config_rows:
        ft = row["finish_type"]
        cat.finish_to_group[ft] = row["finish_group"]
        cat.finish_requires_microbond[ft] = bool(row["requires_microbond"])
        cat.finish_requires_prestain[ft] = bool(row["requires_prestain"])
    return cat


# ---------- math ---------------------------------------------------------------

def _pack_for_coverage(
    sqft_needed: float,
    small: Yield,
    large: Yield,
) -> Tuple[int, int]:
    """
    Return (large_packs, small_packs) to cover sqft_needed.

    Strategy:
      1. Fill large packs that fit fully by coverage.
      2. Top up the remainder with small packs (rounded up).
      3. **Round-up heuristic** (matches the sheet): if step 2 produced
         4+ small packs AND those can be replaced by 1 more large pack
         with sufficient coverage, prefer that — fewer items at
         slightly higher cost. This is what makes the spreadsheet
         output PreStain at 530 sq ft come out as 1×5GL instead of
         4×1GL, while still keeping SLM at 530 sq ft as 3×1GL (only
         3 small packs, no round-up triggered).

    Works correctly even when large coverage isn't exactly 5× small
    coverage — e.g., Microbond's 5GL covers 900 sq ft, not 1000.
    """
    if sqft_needed <= 0:
        return (0, 0)

    if not small.coverage_sqft_per_unit or small.coverage_sqft_per_unit <= 0:
        return (0, 0)

    if not large.coverage_sqft_per_unit or large.coverage_sqft_per_unit <= 0:
        return (0, math.ceil(sqft_needed / small.coverage_sqft_per_unit))

    large_packs = int(sqft_needed // large.coverage_sqft_per_unit)
    remaining = sqft_needed - large_packs * large.coverage_sqft_per_unit
    small_packs = math.ceil(remaining / small.coverage_sqft_per_unit) if remaining > 0 else 0

    # Round-up heuristic: replace 4+ trailing small packs with 1 more large.
    if small_packs >= 4 and large.coverage_sqft_per_unit >= remaining:
        large_packs += 1
        small_packs = 0

    return (large_packs, small_packs)


def _pack_for_unit_count(
    units_needed: int,
    small: Yield,
    large: Yield,
    units_per_large: int = 5,
) -> Tuple[int, int]:
    """
    Return (large_packs, small_packs) for `units_needed` raw units.

    Used when we already know the gallon count (e.g., Color Activator
    mirroring Liquid). Pack 5-per-large by default.
    """
    if units_needed <= 0:
        return (0, 0)
    large_packs = units_needed // units_per_large
    small_packs = units_needed - large_packs * units_per_large
    return (large_packs, small_packs)


def _line_item(y: Yield, qty: int) -> LineItem:
    line_total = round(y.price_retail * qty, 2)
    line_weight = round((y.weight_lbs or 0) * qty, 2) if y.weight_lbs else None
    line_wholesale = (
        round(y.price_wholesale * qty, 2)
        if y.price_wholesale is not None
        else None
    )
    return LineItem(
        product_name=y.product_name,
        sku_size=y.sku_size,
        qty=qty,
        weight_lbs=y.weight_lbs,
        line_weight_lbs=line_weight,
        unit_price_retail=y.price_retail,
        line_total_retail=line_total,
        unit_price_wholesale=y.price_wholesale,
        line_total_wholesale=line_wholesale,
    )


def _packed_lines(
    sqft: float,
    catalog: Catalog,
    finish_group: str,
    category: str,
) -> List[LineItem]:
    """Look up small/large yields for (category, finish_group), pack, return line items."""
    small = catalog.yields_by_key.get(_key(category, finish_group, "small"))
    large = catalog.yields_by_key.get(_key(category, finish_group, "large"))
    if not small or not large:
        # If only one pack size exists, use it as both.
        if small and not large:
            qty = math.ceil(sqft / (small.coverage_sqft_per_unit or 1))
            return [_line_item(small, qty)] if qty > 0 else []
        return []

    large_qty, small_qty = _pack_for_coverage(sqft, small, large)
    items: List[LineItem] = []
    if large_qty > 0:
        items.append(_line_item(large, large_qty))
    if small_qty > 0:
        items.append(_line_item(small, small_qty))
    return items


def _brown_coat_section(bc: BrownCoatInput, catalog: Catalog) -> Optional[Section]:
    """
    Compute the Brown Coat section.

    Math (matches SEMCO's Brown Coat Calculator tab):
      * Volume in cubic inches = (L_ft × 12) × (W_ft × 12) × T_in
      * Displacement gallons   = volume / 231
      * Batches                = floor(displacement / 5)   # 5-gal mixture per batch
      * Per batch:
          - 1 × 50 lb Stone bag
          - 2 GL Liquid (packed into 5 GL / 1 GL)
          - 1/12 of a 20 lb Additive bag (ceil(batches/12) total bags)
    """
    length_in = bc.length_ft * 12.0
    width_in = bc.width_ft * 12.0
    volume_cubic_in = length_in * width_in * bc.thickness_in
    displacement_gal = volume_cubic_in / 231.0
    batches = int(displacement_gal // 5)

    if batches <= 0:
        return None

    # Stone (single 50 lb SKU lives at finish_group='all')
    stone = catalog.yields_by_key.get(_key("stone", "all", "small"))

    # Reuse Vellum/Solid Liquid rows for brown coat (price is finish-independent).
    liquid_small = catalog.yields_by_key.get(_key("liquid", "vellum_solid", "small"))
    liquid_large = catalog.yields_by_key.get(_key("liquid", "vellum_solid", "large"))

    # Additive — only used in brown coat
    additive = catalog.yields_by_key.get(_key("brown_coat_additive", "brown_coat", "small"))

    items: List[LineItem] = []
    if stone:
        items.append(_line_item(stone, batches))

    liquid_gal = batches * 2
    if liquid_large and liquid_small and liquid_gal > 0:
        large_qty, small_qty = _pack_for_unit_count(liquid_gal, liquid_small, liquid_large, units_per_large=5)
        if large_qty > 0:
            items.append(_line_item(liquid_large, large_qty))
        if small_qty > 0:
            items.append(_line_item(liquid_small, small_qty))

    if additive:
        additive_bags = math.ceil(batches / 12)
        if additive_bags > 0:
            items.append(_line_item(additive, additive_bags))

    if not items:
        return None
    return Section(name="Brown Coat", items=items)


def calculate(input: CalcInput, catalog: Catalog) -> CalcResult:
    """Run the full calculation and return a CalcResult."""
    if input.finish_type not in catalog.finish_to_group:
        raise ValueError(f"Unknown finish_type: {input.finish_type}")
    finish_group = catalog.finish_to_group[input.finish_type]
    sqft = input.sqft

    sections: List[Section] = []

    # ---- X-Bond System ------------------------------------------------------
    xbond_items: List[LineItem] = []

    # Stone (single SKU; finish_group='all')
    stone = catalog.yields_by_key.get(_key("stone", "all", "small"))
    if stone and stone.coverage_sqft_per_unit:
        stone_qty = math.ceil(sqft / stone.coverage_sqft_per_unit)
        if stone_qty > 0:
            xbond_items.append(_line_item(stone, stone_qty))

    # Liquid (yield varies by finish_group)
    liquid_items = _packed_lines(sqft, catalog, finish_group, "liquid")
    xbond_items.extend(liquid_items)

    # Color Activator: mirrors Liquid pack counts exactly
    liquid_large_qty = sum(li.qty for li in liquid_items if li.sku_size == "5 GL")
    liquid_small_qty = sum(li.qty for li in liquid_items if li.sku_size == "1 GL")
    activator_large = catalog.yields_by_key.get(_key("color_activator", "all", "large"))
    activator_small = catalog.yields_by_key.get(_key("color_activator", "all", "small"))
    if activator_large and liquid_large_qty > 0:
        xbond_items.append(_line_item(activator_large, liquid_large_qty))
    if activator_small and liquid_small_qty > 0:
        xbond_items.append(_line_item(activator_small, liquid_small_qty))

    # Microbond (Corsa/Polished only)
    if catalog.finish_requires_microbond.get(input.finish_type, False):
        xbond_items.extend(_packed_lines(sqft, catalog, finish_group, "microbond"))

    if xbond_items:
        sections.append(Section(name="X-Bond System", items=xbond_items))

    # ---- Surface Prep -------------------------------------------------------
    prep_items: List[LineItem] = []

    # PreStain (Grain only)
    if catalog.finish_requires_prestain.get(input.finish_type, False):
        prep_items.extend(_packed_lines(sqft, catalog, finish_group, "prestain"))

    # SLM (optional)
    if input.use_slm:
        prep_items.extend(_packed_lines(sqft, catalog, "all", "slm"))

    # Fabric Reinforcement (manual qty, no sqft math)
    if input.fabric_size and input.fabric_qty > 0:
        # Fabric rows live with finish_group='all' and pack_size keyed to the size string.
        # Find the right row by sku_size match.
        fabric = next(
            (
                y for y in catalog.yields_by_key.values()
                if y.product_category == "fabric" and y.sku_size == input.fabric_size
            ),
            None,
        )
        if fabric:
            prep_items.append(_line_item(fabric, input.fabric_qty))

    if prep_items:
        sections.append(Section(name="Surface Prep", items=prep_items))

    # ---- Sealer -------------------------------------------------------------
    if input.sealer and input.sealer != "none":
        sealer_items = _packed_lines(sqft, catalog, "all", input.sealer)
        if sealer_items:
            sections.append(Section(name="Sealer", items=sealer_items))

    # ---- Brown Coat (optional, separate input shape) ------------------------
    if input.brown_coat is not None:
        bc_section = _brown_coat_section(input.brown_coat, catalog)
        if bc_section is not None:
            sections.append(bc_section)

    # ---- Summary ------------------------------------------------------------
    item_count = sum(it.qty for s in sections for it in s.items)
    total_weight = round(
        sum((it.line_weight_lbs or 0.0) for s in sections for it in s.items), 2
    )
    subtotal_retail = round(
        sum(it.line_total_retail for s in sections for it in s.items), 2
    )

    wholesale_values = [
        it.line_total_wholesale for s in sections for it in s.items
        if it.line_total_wholesale is not None
    ]
    subtotal_wholesale: Optional[float] = (
        round(sum(wholesale_values), 2) if wholesale_values else None
    )

    cost_per_sqft = round(subtotal_retail / sqft, 2) if sqft > 0 else 0.0

    return CalcResult(
        input=input,
        finish_group=finish_group,
        sections=sections,
        summary=Summary(
            item_count=item_count,
            total_weight_lbs=total_weight,
            subtotal_retail=subtotal_retail,
            subtotal_wholesale=subtotal_wholesale,
            cost_per_sqft_retail=cost_per_sqft,
        ),
        prices_visible=True,
    )


def strip_prices(result: CalcResult) -> CalcResult:
    """Return a copy of `result` with every monetary field nulled out.

    Used when the requester lacks `can_see_prices`. The user still sees
    line items (qty + weight) and the item count + total weight, but no
    prices, subtotals, or cost-per-sq-ft anywhere in the payload.
    """
    stripped_sections = [
        Section(
            name=s.name,
            items=[
                LineItem(
                    product_name=it.product_name,
                    sku_size=it.sku_size,
                    qty=it.qty,
                    weight_lbs=it.weight_lbs,
                    line_weight_lbs=it.line_weight_lbs,
                    unit_price_retail=None,
                    line_total_retail=None,
                    unit_price_wholesale=None,
                    line_total_wholesale=None,
                    notes=it.notes,
                )
                for it in s.items
            ],
        )
        for s in result.sections
    ]
    return CalcResult(
        input=result.input,
        finish_group=result.finish_group,
        sections=stripped_sections,
        summary=Summary(
            item_count=result.summary.item_count,
            total_weight_lbs=result.summary.total_weight_lbs,
            subtotal_retail=None,
            subtotal_wholesale=None,
            cost_per_sqft_retail=None,
        ),
        prices_visible=False,
    )
