import unittest

from streamlit_demo.core import (
    DEFAULT_TICKETS,
    MockProvider,
    overlap_score,
    retrieve_handbook,
    retrieve_similar,
    run_multi_agent,
    status_metrics,
)


class StreamlitCoreTests(unittest.TestCase):
    def test_overlap_score(self):
        self.assertGreater(
            overlap_score("office wifi laptop", "wifi laptop adapter"),
            overlap_score("office wifi laptop", "payroll leave"),
        )

    def test_parallel_retrieval_ranking(self):
        ticket = {
            "id": "new",
            "title": "Office WiFi disconnect",
            "description": "Laptop wifi disconnects",
        }
        similar = retrieve_similar(ticket, DEFAULT_TICKETS)
        handbook = retrieve_handbook(ticket)
        self.assertEqual(similar[0]["title"], "Office WiFi disconnects")
        self.assertTrue(handbook)
        self.assertEqual(handbook[0]["title"], "Internal Support Handbook")

    def test_full_mock_multi_agent_flow(self):
        ticket = DEFAULT_TICKETS[0]
        run = run_multi_agent(ticket, DEFAULT_TICKETS, MockProvider())
        self.assertEqual(run["triage"]["category"], "IT")
        self.assertTrue(run["evaluation"]["approved"])
        self.assertTrue(run["resolution"]["needsHumanReview"])
        self.assertEqual(run["decision"], "PENDING")
        self.assertIn("similarTickets", run["retrieval"])
        self.assertIn("handbook", run["retrieval"])

    def test_manager_status_metrics(self):
        metrics = status_metrics(DEFAULT_TICKETS)
        self.assertEqual(metrics["OPEN"], 1)
        self.assertEqual(metrics["IN_PROGRESS"], 1)
        self.assertEqual(metrics["RESOLVED"], 1)
        self.assertEqual(metrics["CLOSED"], 0)


if __name__ == "__main__":
    unittest.main()
