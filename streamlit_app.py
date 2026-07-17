from __future__ import annotations

from copy import deepcopy
from uuid import uuid4

import streamlit as st

from streamlit_demo.core import (
    DEFAULT_TICKETS,
    MockProvider,
    run_multi_agent,
    select_provider,
    status_metrics,
)


st.set_page_config(page_title="HelpDesk Lite Demo", page_icon="🎫", layout="wide")

if "tickets" not in st.session_state:
    st.session_state.tickets = deepcopy(DEFAULT_TICKETS)
if "runs" not in st.session_state:
    st.session_state.runs = {}

st.title("🎫 HelpDesk Lite — Multi-Agent Demo")
st.caption(
    "Standalone role demo. AI suggestions require support approval and never "
    "silently resolve or close tickets."
)

role = st.sidebar.selectbox("Demo role", ["Employee", "Support", "Manager"])
provider_choice = st.sidebar.selectbox(
    "AI provider", ["auto", "ollama", "mock"], help="auto falls back to mock"
)


def ticket_by_id(ticket_id: str):
    return next(
        (ticket for ticket in st.session_state.tickets if ticket["id"] == ticket_id),
        None,
    )


if role == "Employee":
    st.header("Employee workspace")
    submit_tab, tickets_tab = st.tabs(["Submit ticket", "My tickets"])
    with submit_tab:
        with st.form("new-ticket", clear_on_submit=True):
            title = st.text_input("Title")
            description = st.text_area("Description")
            category = st.selectbox("Category", ["IT", "HR", "FACILITIES", "OTHER"])
            submitted = st.form_submit_button("Submit ticket", type="primary")
        if submitted:
            if not title.strip() or not description.strip():
                st.error("Title and description are required.")
            else:
                ticket_id = f"HD-{uuid4().hex[:6].upper()}"
                st.session_state.tickets.insert(
                    0,
                    {
                        "id": ticket_id,
                        "title": title.strip(),
                        "description": description.strip(),
                        "category": category,
                        "priority": None,
                        "status": "OPEN",
                        "submitter": "Employee Demo",
                        "assignee": None,
                    },
                )
                st.success(f"Created {ticket_id}.")
    with tickets_tab:
        mine = [
            ticket
            for ticket in st.session_state.tickets
            if ticket["submitter"] == "Employee Demo"
        ]
        st.dataframe(mine, use_container_width=True, hide_index=True)

elif role == "Support":
    st.header("Support workspace")
    queue = [
        ticket
        for ticket in st.session_state.tickets
        if ticket["status"] not in ("RESOLVED", "CLOSED")
        and ticket["assignee"] in (None, "Support Demo")
    ]
    st.dataframe(queue, use_container_width=True, hide_index=True)
    if not queue:
        st.info("No actionable tickets.")
        st.stop()

    selected_id = st.selectbox(
        "Select ticket", [ticket["id"] for ticket in queue]
    )
    ticket = ticket_by_id(selected_id)
    assert ticket is not None

    left, right = st.columns(2)
    with left:
        st.subheader(ticket["title"])
        st.write(ticket["description"])
        st.caption(
            f"{ticket['category']} · {ticket['priority'] or 'No priority'} · "
            f"{ticket['status']} · {ticket['assignee'] or 'Unassigned'}"
        )
        if st.button("Claim ticket", disabled=ticket["assignee"] is not None):
            ticket["assignee"] = "Support Demo"
            st.rerun()
        next_status = st.selectbox(
            "Human-approved status",
            ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"],
            index=["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].index(
                ticket["status"]
            ),
        )
        if st.button("Apply status"):
            ticket["status"] = next_status
            st.success("Status updated by support.")

    with right:
        st.subheader("Multi-agent assist")
        if st.button("Run agents", type="primary"):
            try:
                provider = select_provider(provider_choice)
                with st.spinner(f"Running retrieval and agents via {provider.name}…"):
                    st.session_state.runs[selected_id] = run_multi_agent(
                        ticket, st.session_state.tickets, provider
                    )
            except Exception as error:
                if provider_choice == "auto":
                    st.warning(f"Ollama failed ({error}); using deterministic mock.")
                    st.session_state.runs[selected_id] = run_multi_agent(
                        ticket, st.session_state.tickets, MockProvider()
                    )
                else:
                    st.error(f"Agent run failed: {error}")

        run = st.session_state.runs.get(selected_id)
        if run:
            st.caption(f"{run['provider']} · {run['durationMs']} ms")
            st.json(
                {
                    "triage": run["triage"],
                    "knowledge": run["knowledge"],
                    "resolution": run["resolution"],
                    "evaluation": run["evaluation"],
                },
                expanded=False,
            )
            st.write(run["resolution"].get("draftResponse", ""))
            approve, reject = st.columns(2)
            with approve:
                if st.button("Approve metadata", disabled=run["decision"] != "PENDING"):
                    ticket["category"] = run["triage"].get(
                        "category", ticket["category"]
                    )
                    ticket["priority"] = run["triage"].get(
                        "priority", ticket["priority"]
                    )
                    run["decision"] = "APPROVED"
                    st.success("Category/priority applied. Status was not changed.")
            with reject:
                if st.button("Reject", disabled=run["decision"] != "PENDING"):
                    run["decision"] = "REJECTED"
                    st.info("Recommendation rejected; ticket unchanged.")

else:
    st.header("Manager workspace")
    metrics = status_metrics(st.session_state.tickets)
    columns = st.columns(4)
    for column, (status, count) in zip(columns, metrics.items()):
        column.metric(status.replace("_", " ").title(), count)

    runs = list(st.session_state.runs.values())
    successful = sum(
        bool(run.get("evaluation", {}).get("approved")) for run in runs
    )
    avg_latency = (
        round(sum(run["durationMs"] for run in runs) / len(runs)) if runs else 0
    )
    first, second, third = st.columns(3)
    first.metric("Agent runs", len(runs))
    second.metric(
        "Evaluator approval",
        f"{successful / len(runs):.0%}" if runs else "—",
    )
    third.metric("Average latency", f"{avg_latency} ms" if runs else "—")

    st.subheader("Team tickets")
    st.dataframe(st.session_state.tickets, use_container_width=True, hide_index=True)
    st.subheader("Generated AI briefs")
    if not runs:
        st.info("Run agents as Support to populate manager evidence.")
    for ticket_id, run in reversed(list(st.session_state.runs.items())):
        ticket = ticket_by_id(ticket_id)
        with st.expander(f"{ticket_id} — {ticket['title'] if ticket else 'Ticket'}"):
            st.write(run["resolution"].get("draftResponse", ""))
            st.json(
                {
                    "provider": run["provider"],
                    "durationMs": run["durationMs"],
                    "decision": run["decision"],
                    "evaluation": run["evaluation"],
                }
            )
