# check inputs before using them in reputation and confidence calculations.

from datetime import date, datetime
from math import isfinite
from numbers import Real
from typing import Protocol


class VoteInput(Protocol):
    user_id: str
    is_upvote: bool


class HistoryInput(Protocol):
    price_record_id: str
    submitted_at: datetime | None
    upvotes: int
    downvotes: int


def validate_number(name: str, value: float, maximum: float | None = None) -> None:
    if isinstance(value, bool) or not isinstance(value, Real):
        raise ValueError(f"{name} must be a finite number.")
    if not isfinite(value) or value < 0 or (maximum is not None and value > maximum):
        raise ValueError(f"{name} is outside its valid range.")


def validate_count(name: str, value: int) -> None:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError(f"{name} must be a nonnegative integer.")


def validate_positive(value: float, message: str) -> None:
    # make sure the value is above zero after checking its type and range.
    if value <= 0:
        raise ValueError(message)


def validate_identifier(value: str, message: str) -> None:
    if not isinstance(value, str) or not value:
        raise ValueError(message)


def validate_nonempty_pool(histories: object) -> None:
    if not histories:
        raise ValueError("A pool must have at least one active submitter.")


def validate_aware_datetime(
    value: datetime, message: str = "Timestamps must be timezone-aware datetimes.",
) -> None:
    if not isinstance(value, datetime) or value.utcoffset() is None:
        raise ValueError(message)


def validate_recorded_date(value: date | datetime) -> None:
    if not isinstance(value, date):
        raise ValueError("recorded_at must be a date or aware datetime.")


def validate_recording_time(recorded_at: datetime, now: datetime) -> None:
    if now < recorded_at:
        raise ValueError("Price recording time cannot be in the future.")


def validate_vote(vote: VoteInput, seen: set[str]) -> None:
    validate_identifier(vote.user_id, "A voter ID is required.")
    if not isinstance(vote.is_upvote, bool):
        raise ValueError("is_upvote must be a boolean.")
    if vote.user_id in seen:
        raise ValueError("Each user may contribute only one current vote.")
    seen.add(vote.user_id)


def validate_confirmation_vote(vote: VoteInput, seen: set[str]) -> None:
    # check for duplicate voters before checking their vote flag.
    validate_identifier(vote.user_id, "A voter ID is required.")
    if vote.user_id in seen:
        raise ValueError("Each user may contribute only one current vote.")
    seen.add(vote.user_id)
    if not isinstance(vote.is_upvote, bool):
        raise ValueError("is_upvote must be a boolean.")


def validate_history_row(
    row: HistoryInput, seen: set[tuple[str, datetime | None]],
) -> None:
    validate_identifier(row.price_record_id, "Each history row needs a shared price record ID.")
    if row.submitted_at is not None:
        validate_aware_datetime(row.submitted_at, "submitted_at must be a timezone-aware datetime.")
    period = (row.price_record_id, row.submitted_at)
    if period in seen:
        raise ValueError("Duplicate history period; combine each page only once.")
    seen.add(period)
    validate_count("upvotes", row.upvotes)
    validate_count("downvotes", row.downvotes)
