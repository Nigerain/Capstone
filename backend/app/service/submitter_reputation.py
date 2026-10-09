
def calculate_reputation(
    successful_submissions: int,
    evaluated_submissions: int,
    alpha: float = 2.0,
    beta: float = 2.0
) -> float:
    """
    Calculate user reputation using Bayesian smoothing.

    Formula:
        (successful_submissions + alpha)
        / (evaluated_submissions + alpha + beta)

    Returns:
        Reputation score between 0.0 and 1.0.
    """

    if evaluated_submissions < 0 or successful_submissions < 0:
        raise ValueError("Submission counts cannot be negative.")

    if successful_submissions > evaluated_submissions:
        raise ValueError(
            "Successful submissions cannot exceed evaluated submissions."
        )

    if alpha <= 0 or beta <= 0:
        raise ValueError("Alpha and beta must be positive.")

    reputation = (
        (successful_submissions + alpha)
        / (evaluated_submissions + alpha + beta)
    )

    return reputation
