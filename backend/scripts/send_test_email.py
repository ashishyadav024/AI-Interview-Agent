#!/usr/bin/env python3
"""
Admin CLI Command: Send Test Email
Validates SMTP configuration and tests email delivery without exposing credentials.

Usage:
  python backend/scripts/send_test_email.py --to test@example.com
  python backend/scripts/send_test_email.py
"""

import os
import sys
import argparse
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

try:
    from dotenv import load_dotenv
    load_dotenv(backend_dir / ".env")
except ImportError:
    pass

from services.email_service import EmailService


def main():
    parser = argparse.ArgumentParser(description="Test SMTP configuration and dispatch a test email.")
    parser.add_argument("--to", help="Destination email address for the test message", default=None)
    parser.add_argument("--candidate-name", help="Candidate name for simulation", default="Test Candidate")
    parser.add_argument("--role", help="Job role for simulation", default="Full Stack Engineer")
    args = parser.parse_args()

    recipient = args.to
    if not recipient:
        try:
            recipient = input("Enter recipient email address: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nAborted.")
            sys.exit(1)

    if not recipient or "@" not in recipient:
        print("❌ Error: Invalid recipient email address.")
        sys.exit(1)

    print("=" * 60)
    print("🔍 SMTP Configuration Pre-flight Check")
    print("=" * 60)

    email_service = EmailService()
    config = email_service.validate_configuration()

    print(f"• Server:   {email_service.smtp_server}:{email_service.smtp_port}")
    print(f"• Sender:   {email_service.sender_email or '(not set)'}")
    print(f"• User:     {'[Configured]' if email_service.smtp_username else '[Missing]'}")
    print(f"• Password: {'[Configured]' if email_service.smtp_password else '[Missing]'}")
    print(f"• Company:  {email_service.company_name}")
    print("-" * 60)

    if not config.get("configured"):
        print(f"❌ Configuration check failed: {config.get('message')}")
        print("Please configure SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD in your environment.")
        sys.exit(1)

    print(f"📤 Dispatching sample AI interview invitation to: {recipient}...")
    sample_url = "https://ai-interview-agent-three-taupe.vercel.app/interview/demo-test-token"

    result = email_service.send_ai_interview_link(
        to_email=recipient,
        candidate_name=args.candidate_name,
        job_title=args.role,
        interview_url=sample_url,
        expires_at="Within 48 hours"
    )

    if result.get("success"):
        print("✅ SUCCESS: Test email dispatched successfully!")
        print(f"   Status: {result.get('status')}")
        print(f"   Sent at: {result.get('sent_at')}")
        print("=" * 60)
        sys.exit(0)
    else:
        print("❌ FAILED: Email could not be dispatched.")
        print(f"   Error: {result.get('error')}")
        print(f"   Message: {result.get('message')}")
        print("=" * 60)
        sys.exit(1)


if __name__ == "__main__":
    main()
