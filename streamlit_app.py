"""Streamlit entry point for the GeoTwin Sentinel research prototype."""

from __future__ import annotations

import streamlit as st
from app.models.domain import CounterfactualRunRequest, InterventionSelection
from app.services.catalog import hospital_map
from app.services.counterfactuals import intervention_catalog, run_counterfactual_comparison
from app.services.scenarios import get_scenario_catalog
from app.services.twin import run_simulation

SAFETY_STATEMENT = (
    "GeoTwin Sentinel is a research decision-support prototype using synthetic data. "
    "Its outputs are simulated estimates intended for authorized human review and are "
    "not clinical, transfer, cybersecurity, infrastructure-control, or emergency-response "
    "instructions."
)


def _status_icon(status: str) -> str:
    return {"stable": "🟢", "degraded": "🟠", "critical": "🔴"}.get(status, "⚪")


def _render_simulation(result) -> None:
    trust = result.trust
    critical = sum(item.status.value == "critical" for item in result.affected_hospitals)
    degraded = sum(item.status.value == "degraded" for item in result.affected_hospitals)

    st.subheader("Regional situation")
    columns = st.columns(5)
    columns[0].metric("Regional risk", f"{result.regional_risk_score:.1%}")
    columns[1].metric("Resilience", f"{result.resilience_score:.1%}")
    columns[2].metric("Telemetry integrity", f"{trust.telemetry_integrity:.1%}")
    columns[3].metric("Critical hospitals", critical)
    columns[4].metric("Degraded hospitals", degraded)

    if trust.human_review_required:
        st.error("Authorized human review is mandatory for this result.")
    else:
        st.info("Human review remains required before operational use.")

    st.write(result.explanation)

    catalog = hospital_map()
    map_rows = [
        {
            "latitude": catalog[state.hospital_id].latitude,
            "longitude": catalog[state.hospital_id].longitude,
            "hospital": catalog[state.hospital_id].name,
            "status": state.status.value,
            "risk": state.disruption_probability,
        }
        for state in result.affected_hospitals
    ]
    st.subheader("Synthetic healthcare network")
    st.map(map_rows, latitude="latitude", longitude="longitude", size=90)

    hospital_rows = [
        {
            "Status": f"{_status_icon(state.status.value)} {state.status.value.title()}",
            "Hospital": catalog[state.hospital_id].name,
            "Risk": f"{state.disruption_probability:.1%}",
            "Load": f"{state.load_ratio:.2f}×",
            "Capacity": round(state.effective_capacity, 1),
            "Demand": round(state.estimated_demand, 1),
        }
        for state in result.affected_hospitals
    ]
    st.dataframe(hospital_rows, width="stretch", hide_index=True)

    agent_tab, trust_tab, transfer_tab, observability_tab = st.tabs(
        ["Agent activity", "Trust & evidence", "Transfers", "Observability"]
    )
    with agent_tab:
        st.dataframe(
            [
                {
                    "Agent": item.agent_name or item.agent,
                    "Stage": item.stage,
                    "Status": item.status,
                    "Action": item.action,
                    "Confidence": f"{item.confidence:.1%}",
                    "Duration (ms)": item.duration_ms,
                    "Human review": item.human_review_required,
                }
                for item in result.agent_decisions
            ],
            width="stretch",
            hide_index=True,
        )
        for item in result.agent_decisions:
            with st.expander(item.agent_name or item.agent):
                st.write(item.explanation)
                if item.warning:
                    st.warning(item.warning)

    with trust_tab:
        st.progress(trust.trust_score or 0, text=f"Trust score: {(trust.trust_score or 0):.1%}")
        st.write(f"Calculation version: `{trust.calculation_version}`")
        if trust.review_reasons:
            st.markdown("#### Review reasons")
            for reason in trust.review_reasons:
                st.warning(f"**{reason.code}:** {reason.explanation}")
        st.dataframe(
            [
                {
                    "Evidence": item.evidence_id,
                    "Source": item.source_name or item.source,
                    "Integrity": item.integrity_status,
                    "Reliability": f"{item.reliability:.1%}",
                    "Warning": item.warning or "",
                }
                for item in result.evidence
            ],
            width="stretch",
            hide_index=True,
        )

    with transfer_tab:
        if result.transfer_plan:
            st.dataframe(
                [
                    {
                        "From": catalog[item.from_hospital_id].name,
                        "To": catalog[item.to_hospital_id].name,
                        "Synthetic patients": item.patients,
                        "Constraints satisfied": item.safety_constraints_satisfied,
                        "Rationale": item.rationale,
                    }
                    for item in result.transfer_plan
                ],
                width="stretch",
                hide_index=True,
            )
        else:
            st.info("No transfers were proposed by this simulation.")

    with observability_tab:
        st.metric("Simulation duration", f"{result.duration_ms:.2f} ms")
        st.code(result.trace_id or "No trace ID: OTLP export is not active in this deployment.")
        st.caption(
            "When OTLP is configured server-side, use this trace ID in SigNoz Traces Explorer. "
            "No ingestion credentials are exposed in the browser."
        )


def _render_counterfactuals(result) -> None:
    definitions = {
        item.id: item
        for item in intervention_catalog()
        if item.id not in {"no-intervention"}
    }
    default_ids = [
        "telemetry-verification",
        "network-segmentation",
        "regional-surge-capacity",
    ]
    selected = st.multiselect(
        "Interventions to compare",
        options=list(definitions),
        default=[item for item in default_ids if item in definitions],
        format_func=lambda item: definitions[item].name,
    )
    if st.button("Compare interventions", disabled=not selected, width="stretch"):
        with st.spinner("Rerunning the digital twin with bounded interventions…"):
            st.session_state.comparison = run_counterfactual_comparison(
                CounterfactualRunRequest(
                    simulation_id=result.simulation_id,
                    interventions=[
                        InterventionSelection(intervention_id=item) for item in selected
                    ],
                )
            )

    comparison = st.session_state.get("comparison")
    if comparison is None or comparison.simulation_id != result.simulation_id:
        return

    st.markdown("#### Counterfactual ranking")
    st.info(comparison.recommendation.label)
    by_id = {item.intervention_id: item for item in comparison.interventions}
    st.dataframe(
        [
            {
                "Rank": ranked.rank,
                "Intervention": by_id[ranked.intervention_id].intervention_name,
                "Overall score": round(ranked.overall_score, 3),
                "Risk reduction": f"{(by_id[ranked.intervention_id].absolute_risk_reduction or 0):.1%}",
                "Trust": f"{(by_id[ranked.intervention_id].recommendation_confidence or 0):.1%}",
                "Review required": by_id[ranked.intervention_id].human_review_required,
            }
            for ranked in comparison.ranking
        ],
        width="stretch",
        hide_index=True,
    )
    for outcome in comparison.interventions:
        if outcome.status == "failed":
            st.warning(f"{outcome.intervention_name}: {outcome.error}")


def main() -> None:
    st.set_page_config(
        page_title="GeoTwin Sentinel",
        page_icon="🏥",
        layout="wide",
        initial_sidebar_state="expanded",
    )
    st.title("GeoTwin Sentinel")
    st.caption("An observable agentic digital twin for healthcare infrastructure resilience")
    st.warning(SAFETY_STATEMENT)

    scenarios = get_scenario_catalog()
    by_id = {item.id: item for item in scenarios}
    with st.sidebar:
        st.header("Simulation controls")
        scenario_id = st.selectbox(
            "Compound disruption",
            options=list(by_id),
            index=list(by_id).index("wildfire-telemetry")
            if "wildfire-telemetry" in by_id
            else 0,
            format_func=lambda item: by_id[item].name,
        )
        scenario = by_id[scenario_id]
        st.write(scenario.description)
        st.caption(" · ".join(scenario.tags))
        demo_fault = st.selectbox(
            "Synthetic demo fault",
            options=["none", "security-agent-delay", "security-agent-failure"],
            help="Explicit synthetic test mode. Disabled by default.",
        )
        run_clicked = st.button("Run simulation", type="primary", width="stretch")
        st.divider()
        st.markdown(
            "[Source repository](https://github.com/harshapriyag123/"
            "agentic-healthcare-digital-twi)"
        )

    if run_clicked:
        st.session_state.comparison = None
        request = scenario.request.model_copy(update={"demo_fault": demo_fault})
        with st.spinner("Running digital twin and agent workflow…"):
            st.session_state.simulation = run_simulation(request)

    result = st.session_state.get("simulation")
    if result is None:
        st.info("Select a scenario and run the simulation. The wildfire scenario is the judge demo.")
        return

    _render_simulation(result)
    st.divider()
    st.subheader("Counterfactual explorer")
    _render_counterfactuals(result)
    st.divider()
    st.caption(SAFETY_STATEMENT)


if __name__ == "__main__":
    main()
