from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class KBEntryBase(BaseModel):
    """Shared fields for create/update."""

    question: str = Field(..., min_length=1, description="The knowledge base question")
    answer: str = Field(..., min_length=1, description="The knowledge base answer")
    category: str = Field(
        default="",
        description="Category: safety, mixing, curing, surface_prep, etc.",
    )
    products: List[str] = Field(
        default_factory=list, description="Associated product names"
    )
    substrates: List[str] = Field(
        default_factory=list, description="Associated substrate names"
    )
    source: str = Field(
        default="",
        description="Origin: excel, tds_sds, tidio, shopify, manual",
    )


class KBEntryCreate(KBEntryBase):
    """Request body for creating a KB entry."""

    pass


class KBEntryUpdate(BaseModel):
    """Request body for updating a KB entry. All fields optional."""

    question: Optional[str] = Field(None, min_length=1)
    answer: Optional[str] = Field(None, min_length=1)
    category: Optional[str] = None
    products: Optional[List[str]] = None
    substrates: Optional[List[str]] = None
    source: Optional[str] = None


class KBEntryRead(KBEntryBase):
    """Response model for a KB entry."""

    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class KBEntryList(BaseModel):
    """Paginated list response."""

    data: List[KBEntryRead]
    count: int
