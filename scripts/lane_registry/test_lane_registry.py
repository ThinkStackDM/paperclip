#!/usr/bin/env python3
"""Unit tests for the lane-registry expansion logic. Run: python3 test_lane_registry.py"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib


def A(adapter, name, role="general"):
    return {"adapter": adapter, "name": name, "status": "idle", "role": role}


class TestBase(unittest.TestCase):
    def test_base_of(self):
        self.assertEqual(lib.base_of("GLaD0S-Codex"), "GLaD0S")
        self.assertEqual(lib.base_of("MIDAS-Hermes"), "MIDAS")
        self.assertEqual(lib.base_of("Atlas"), "Atlas")
        # "CodexEngineer" must NOT be split (suffix is -Codex, not a prefix)
        self.assertEqual(lib.base_of("CodexEngineer"), "CodexEngineer")
        self.assertEqual(lib.base_of("HermesEngineer"), "HermesEngineer")

    def test_is_suffixed(self):
        self.assertTrue(lib.is_suffixed("Forge-Codex"))
        self.assertFalse(lib.is_suffixed("Forge"))

    def test_family_rank(self):
        self.assertLess(lib.family_rank("claude_local"), lib.family_rank("codex_local"))
        self.assertLess(lib.family_rank("codex_local"), lib.family_rank("hermes_local"))
        self.assertLess(lib.family_rank("antigravity_local"), lib.family_rank("hermes_local"))
        self.assertEqual(lib.family_rank("totally_unknown"), lib.UNKNOWN_RANK)


class TestOrdering(unittest.TestCase):
    def test_tier_order(self):
        agents = {
            "c": A("claude_local", "MIDAS"),
            "x": A("codex_local", "MIDAS-Codex"),
            "h": A("hermes_local", "MIDAS-Hermes"),
        }
        self.assertEqual(lib.order_members(["h", "x", "c"], agents), ["c", "x", "h"])

    def test_same_family_tiebreak_base_before_clone(self):
        # Capital "Compiler" lane: base + clone both hermes_local. Base must lead.
        agents = {
            "base": A("hermes_local", "Compiler"),
            "clone": A("hermes_local", "Compiler-Hermes"),
        }
        # order is independent of input order
        self.assertEqual(lib.order_members(["clone", "base"], agents), ["base", "clone"])
        self.assertEqual(lib.order_members(["base", "clone"], agents), ["base", "clone"])

    def test_antigravity_before_hermes(self):
        agents = {
            "g": A("antigravity_local", "GrowthSEO-Gemini"),
            "h": A("hermes_local", "GrowthSEO-Hermes"),
        }
        self.assertEqual(lib.order_members(["h", "g"], agents), ["g", "h"])


class TestExpansion(unittest.TestCase):
    def test_transitive_chains(self):
        self.assertEqual(
            lib.expand_chains(["c", "x", "h"]),
            {"c": ["x", "h"], "x": ["h"]},  # h is bottom -> omitted
        )

    def test_lane_chains_full(self):
        agents = {
            "c": A("claude_local", "MIDAS"),
            "x": A("codex_local", "MIDAS-Codex"),
            "h": A("hermes_local", "MIDAS-Hermes"),
        }
        self.assertEqual(
            lib.lane_chains(["h", "c", "x"], agents),
            {"c": ["x", "h"], "x": ["h"]},
        )

    def test_two_member_lane(self):
        agents = {"p": A("claude_local", "BrandDesigner"), "s": A("codex_local", "BrandDesigner-Codex")}
        self.assertEqual(lib.lane_chains(["p", "s"], agents), {"p": ["s"]})


class TestContentOrdering(unittest.TestCase):
    def test_agentic_codex_primary(self):
        # codex CEO -> next most capable: gemini-pro, then opus, then grok
        agents = {
            "cx": A("codex_local", "GLaD0S-Codex", "ceo"),
            "cl": A("claude_local", "GLaD0S", "ceo"),
            "gm": A("antigravity_local", "GLaD0S-Gemini", "ceo"),
            "hm": A("hermes_local", "GLaD0S-Hermes", "ceo"),
        }
        self.assertEqual(lib.order_lane("cx", ["cx", "cl", "gm", "hm"], agents),
                         ["cx", "gm", "cl", "hm"])

    def test_agentic_non_codex_primary_fails_up(self):
        # gemini-pro primary (GrowthSEO) must fail UP to codex (most capable), not down to grok
        agents = {
            "gm": A("antigravity_local", "GrowthSEO-Gemini", "engineer"),
            "cx": A("codex_local", "GrowthSEO-Codex", "engineer"),
            "hm": A("hermes_local", "GrowthSEO-Hermes", "engineer"),
        }
        self.assertEqual(lib.order_lane("gm", ["gm", "cx", "hm"], agents),
                         ["gm", "cx", "hm"])  # gemini -> codex -> grok
        self.assertEqual(lib.lane_chains_for("gm", ["gm", "cx", "hm"], agents),
                         {"gm": ["cx", "hm"], "cx": ["hm"]})

    def test_agentic_grok_primary_fails_up(self):
        # promoted Capital engineer scenario: a grok primary fails UP to codex
        agents = {
            "hm": A("hermes_local", "Engineer", "engineer"),
            "cx": A("codex_local", "Engineer-Codex", "engineer"),
        }
        self.assertEqual(lib.order_lane("hm", ["hm", "cx"], agents), ["hm", "cx"])

    def test_content_lane_gemini_before_codex(self):
        # Author (claude content worker): primary first, then gemini-flash, then codex
        agents = {
            "cl": A("claude_local", "Author", "general"),
            "cx": A("codex_local", "Author-Codex", "general"),
            "gm": A("antigravity_local", "Author-Gemini", "general"),
        }
        self.assertEqual(lib.order_lane("cl", ["cl", "cx", "gm"], agents),
                         ["cl", "gm", "cx"])  # claude -> gemini-flash -> codex
        self.assertEqual(lib.lane_chains_for("cl", ["cl", "cx", "gm"], agents),
                         {"cl": ["gm", "cx"], "gm": ["cx"]})

    def test_content_classification(self):
        self.assertTrue(lib.is_content_lane({"name": "Author", "role": "general"}))
        self.assertTrue(lib.is_content_lane({"name": "ContentStrategist", "role": "cmo"}))
        self.assertTrue(lib.is_content_lane({"name": "Books-Drafter", "role": "general"}))
        self.assertFalse(lib.is_content_lane({"name": "Ledger", "role": "general"}))
        self.assertFalse(lib.is_content_lane({"name": "GLaD0S-Codex", "role": "ceo"}))


class TestGrouping(unittest.TestCase):
    def test_group_scope(self):
        agents = {
            "1": A("claude_local", "Forge"),
            "2": A("codex_local", "Forge-Codex"),
            "3": A("hermes_local", "Forge-Hermes"),
            "9": A("codex_local", "CodexEngineer"),  # singleton lane
        }
        lanes = lib.group_scope_into_lanes(["1", "2", "3", "9"], agents)
        self.assertEqual(sorted(lanes["Forge"]), ["1", "2", "3"])
        self.assertEqual(lanes["CodexEngineer"], ["9"])  # singleton -> caller drops

    def test_company_member_sets(self):
        rows = [
            {"company_id": "C", "primary": "p", "sister": "s1", "priority": 1},
            {"company_id": "C", "primary": "p", "sister": "s2", "priority": 2},
        ]
        ms = lib.company_member_sets(rows)
        self.assertEqual(ms["C"]["p"], {"p", "s1", "s2"})


if __name__ == "__main__":
    unittest.main(verbosity=2)
