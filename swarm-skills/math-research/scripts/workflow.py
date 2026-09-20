"""Portable SwarmFlow entry point for the exploration team."""
import importlib.util
from pathlib import Path

META = {"name": "Triviality exploration team", "description": "Explore, challenge and restart competing approaches.",
        "phases": ["Plan", "Explore", "Challenge", "Formalize", "Deliver"]}

async def run(args):
    spec = importlib.util.spec_from_file_location("triviality_exploration", Path(__file__).with_name("exploration.py"))
    workflow = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(workflow)
    return await workflow.run(args or {})
