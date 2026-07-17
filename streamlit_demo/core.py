from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import Any, Protocol


HANDBOOK = """
IT: For WiFi and laptop connectivity, verify the corporate SSID, forget and
re-add the network, restart the wireless adapter, and check VPN status.
HR: Missing payslips and incorrect leave balances go to HR. Ask for the pay
period and employee ID. Never expose payroll details publicly.
FACILITIES: Standing desks, chairs, parking, and HVAC go to Facilities.
Water leaks are urgent and must be reported immediately.
""".strip()


DEFAULT_TICKETS: list[dict[str, Any]] = [
    {
        "id": "HD-101",
        "title": "Office WiFi disconnects",
        "description": "My laptop drops the office WiFi every few minutes.",
        "category": "IT",
        "priority": "MEDIUM",
        "status": "OPEN",
        "submitter": "Employee Demo",
        "assignee": None,
    },
    {
        "id": "HD-102",
        "title": "Missing March payslip",
        "description": "The March payslip is missing from my portal.",
        "category": "HR",
        "priority": "MEDIUM",
        "status": "IN_PROGRESS",
        "submitter": "Employee Demo",
        "assignee": "Support Demo",
    },
    {
        "id": "HD-103",
        "title": "Water leak at reception",
        "description": "Water is leaking from the ceiling above reception.",
        "category": "FACILITIES",
        "priority": "URGENT",
        "status": "RESOLVED",
        "submitter": "Another Employee",
        "assignee": "Support Demo",
    },
]


def tokenize(text: str) -> set[str]:
    return {
        token
        for token in re.sub(r"[^a-z0-9\s]", " ", text.lower()).split()
        if len(token) > 2
    }


def overlap_score(query: str, candidate: str) -> float:
    query_tokens = tokenize(query)
    if not query_tokens:
        return 0.0
    return len(query_tokens & tokenize(candidate)) / len(query_tokens)


def retrieve_similar(
    ticket: dict[str, Any], history: list[dict[str, Any]], limit: int = 3
) -> list[dict[str, Any]]:
    query = f"{ticket['title']} {ticket['description']}"
    hits = [
        {
            "title": item["title"],
            "category": item["category"],
            "score": overlap_score(
                query, f"{item['title']} {item['description']} {item['category']}"
            ),
        }
        for item in history
        if item["id"] != ticket["id"]
    ]
    return sorted(
        (hit for hit in hits if hit["score"] > 0),
        key=lambda hit: hit["score"],
        reverse=True,
    )[:limit]


def retrieve_handbook(ticket: dict[str, Any]) -> list[dict[str, Any]]:
    query = f"{ticket['title']} {ticket['description']}"
    sections = [section.strip() for section in HANDBOOK.splitlines() if section.strip()]
    hits = [
        {
            "title": "Internal Support Handbook",
            "excerpt": section,
            "score": overlap_score(query, section),
        }
        for section in sections
    ]
    return sorted(
        (hit for hit in hits if hit["score"] > 0),
        key=lambda hit: hit["score"],
        reverse=True,
    )[:3]


class Provider(Protocol):
    name: str

    def complete(self, system: str, user: str) -> dict[str, Any]: ...


@dataclass
class MockProvider:
    name: str = "mock"

    def complete(self, system: str, user: str) -> dict[str, Any]:
        text = user.lower()
        if "triage" in system.lower():
            if any(word in text for word in ("wifi", "laptop", "vpn", "printer")):
                category, priority = "IT", "MEDIUM"
            elif any(word in text for word in ("payslip", "leave", "payroll")):
                category, priority = "HR", "MEDIUM"
            elif any(word in text for word in ("leak", "desk", "chair", "hvac")):
                category = "FACILITIES"
                priority = "URGENT" if "leak" in text else "LOW"
            else:
                category, priority = "OTHER", "MEDIUM"
            return {
                "category": category,
                "priority": priority,
                "confidence": 0.86,
                "rationale": "Deterministic demo classification.",
            }
        if "knowledge" in system.lower():
            return {
                "summary": "Relevant handbook guidance was retrieved.",
                "suggestedSteps": [
                    "Confirm the reported details",
                    "Apply the matching handbook checklist",
                    "Escalate if the issue persists",
                ],
            }
        if "evaluator" in system.lower():
            return {
                "approved": True,
                "confidence": 0.9,
                "notes": "Draft is safe, useful, and requires human approval.",
            }
        return {
            "draftResponse": (
                "Thanks for reporting this. We reviewed similar tickets and the "
                "internal handbook. A support teammate will confirm the suggested "
                "steps before applying any ticket changes."
            ),
            "recommendedActions": [
                "Review the drafted response",
                "Confirm category and priority",
            ],
            "needsHumanReview": True,
            "confidence": 0.82,
        }


@dataclass
class OllamaProvider:
    base_url: str = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    model: str = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
    timeout: float = 120.0

    @property
    def name(self) -> str:
        return f"ollama:{self.model}"

    def complete(self, system: str, user: str) -> dict[str, Any]:
        payload = json.dumps(
            {
                "model": self.model,
                "stream": False,
                "format": "json",
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "options": {"temperature": 0.2},
            }
        ).encode()
        request = urllib.request.Request(
            f"{self.base_url.rstrip('/')}/api/chat",
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=self.timeout) as response:
            body = json.loads(response.read())
        content = body.get("message", {}).get("content") or body.get("response")
        if not content:
            raise ValueError("Ollama returned empty content")
        return json.loads(content)


def select_provider(preference: str = "auto") -> Provider:
    if preference == "mock":
        return MockProvider()
    provider = OllamaProvider()
    try:
        request = urllib.request.Request(f"{provider.base_url.rstrip('/')}/api/tags")
        with urllib.request.urlopen(request, timeout=2):
            return provider
    except (OSError, urllib.error.URLError):
        if preference == "ollama":
            raise
        return MockProvider()


def run_multi_agent(
    ticket: dict[str, Any],
    history: list[dict[str, Any]],
    provider: Provider,
) -> dict[str, Any]:
    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=2) as executor:
        history_future = executor.submit(retrieve_similar, ticket, history)
        handbook_future = executor.submit(retrieve_handbook, ticket)
        similar = history_future.result()
        handbook = handbook_future.result()

    ticket_text = json.dumps(
        {"title": ticket["title"], "description": ticket["description"]}
    )
    triage = provider.complete(
        "You are a triage agent. Return JSON with category, priority, confidence, rationale.",
        f"TRIAGE this ticket: {ticket_text}\nSimilar tickets: {json.dumps(similar)}",
    )
    knowledge = provider.complete(
        "You are a knowledge agent. Return JSON with summary and suggestedSteps.",
        f"Ticket: {ticket_text}\nHandbook evidence: {json.dumps(handbook)}",
    )
    resolution = provider.complete(
        "You are a resolution agent. Return JSON with draftResponse, recommendedActions, needsHumanReview, confidence.",
        f"Ticket: {ticket_text}\nTriage: {json.dumps(triage)}\nKnowledge: {json.dumps(knowledge)}",
    )
    evaluation = provider.complete(
        "You are an evaluator agent. Return JSON with approved, confidence, notes.",
        f"Triage: {json.dumps(triage)}\nKnowledge: {json.dumps(knowledge)}\nResolution: {json.dumps(resolution)}",
    )
    return {
        "provider": provider.name,
        "durationMs": round((time.perf_counter() - started) * 1000),
        "retrieval": {"similarTickets": similar, "handbook": handbook},
        "triage": triage,
        "knowledge": knowledge,
        "resolution": resolution,
        "evaluation": evaluation,
        "decision": "PENDING",
    }


def status_metrics(tickets: list[dict[str, Any]]) -> dict[str, int]:
    statuses = ("OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED")
    return {
        status: sum(ticket["status"] == status for ticket in tickets)
        for status in statuses
    }
