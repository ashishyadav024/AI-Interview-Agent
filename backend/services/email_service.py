"""
Email Service - Send professional emails for interviews and notifications

Features:
- Send interview invitations with Meet links
- Professional HTML email templates
- SMTP configuration from environment
- Error handling with 200 status codes
"""

import logging
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Dict, Any, Optional

from repositories.email_repository import EmailRepository

logger = logging.getLogger(__name__)


class EmailService:
    """Service for email-related operations"""
    
    def __init__(self):
        self.email_repo = EmailRepository()
        
        # SMTP Configuration (Environment variables only)
        self.smtp_server = os.getenv('SMTP_HOST') or os.getenv('SMTP_SERVER') or 'smtp.gmail.com'
        try:
            self.smtp_port = int(os.getenv('SMTP_PORT', '587'))
        except (ValueError, TypeError):
            self.smtp_port = 587

        self.smtp_username = (os.getenv('SMTP_USER') or os.getenv('SMTP_USERNAME') or '').strip()
        self.smtp_password = (os.getenv('SMTP_PASSWORD') or os.getenv('SMTP_APP_PASSWORD') or '').strip()
        self.sender_email = (os.getenv('SMTP_FROM_EMAIL') or os.getenv('SENDER_EMAIL') or self.smtp_username or '').strip()
        self.company_name = (os.getenv('COMPANY_NAME') or os.getenv('SMTP_FROM_NAME') or 'AI Interview Agent').strip()
        
        # Validate configuration on startup without printing credentials
        self.validate_configuration()

    def validate_configuration(self) -> Dict[str, Any]:
        """Validate SMTP credentials on startup without printing secrets."""
        missing = []
        if not self.smtp_server:
            missing.append("SMTP_HOST")
        if not self.smtp_username:
            missing.append("SMTP_USER")
        if not self.smtp_password:
            missing.append("SMTP_PASSWORD")

        if missing:
            msg = f"SMTP configuration incomplete (missing: {', '.join(missing)}). Outgoing email delivery is unconfigured."
            logger.warning(f"⚠️ {msg}")
            return {"configured": False, "missing": missing, "message": msg}
        else:
            msg = f"SMTP service configured for {self.smtp_server}:{self.smtp_port} (sender: {self.sender_email or self.smtp_username})"
            logger.info(f"✅ {msg}")
            return {"configured": True, "missing": [], "message": msg}
    
    def send_interview_invitation(
        self,
        to_email: str,
        candidate_name: str,
        job_title: str,
        meet_link: str,
        scheduled_datetime: datetime,
        duration_minutes: int,
        interview_id: str,
        auto_start_bot: bool = True,
        auto_join_token: str = None,
        backend_url: str = None
    ) -> Dict[str, Any]:
        """
        Send interview invitation email
        
        Returns:
            Dict with success status (always 200)
            {
                "success": True/False,
                "email_id": str,
                "message": str,
                "status": "sent" / "failed",
                "preview_url": str (if development mode)
            }
        """
        backend_url = backend_url or os.getenv("BACKEND_URL", "http://localhost:8001")
        logger.info(f"📧 Preparing interview invitation email for {to_email}")
        
        try:
            # Validate SMTP credentials
            if not self.smtp_username or not self.smtp_password:
                error_msg = "SMTP credentials not configured"
                logger.error(f"❌ {error_msg}")
                return {
                    "success": False,
                    "error": error_msg,
                    "message": "Email service not configured"
                }
            
            # Format datetime
            formatted_datetime = scheduled_datetime.strftime('%B %d, %Y at %I:%M %p UTC')
            
            # Build email
            subject = f"🎯 Interview Invitation - {job_title}"
            
            # Build trigger URL or direct meeting link
            if auto_start_bot and auto_join_token:
                # Use trigger endpoint for auto-bot joining
                button_link = f"{backend_url}/api/meet/trigger/{interview_id}?token={auto_join_token}"
                button_text = "🚀 Start Interview Now"
                button_color = "#10b981"
                sub_text = "✨ Bot will automatically join when you click"
            else:
                # Direct Google Meet link (no auto-bot)
                button_link = meet_link
                button_text = "🔗 Join Interview"
                button_color = "#667eea"
                sub_text = "Click to join the meeting"
            
            # HTML email body
            html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
        .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
        .info-box {{ background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #667eea; border-radius: 5px; }}
        .button {{ display: inline-block; padding: 15px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }}
        .footer {{ text-align: center; padding: 20px; color: #888; font-size: 12px; }}
        .highlight {{ color: #667eea; font-weight: bold; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Interview Invitation</h1>
        </div>
        <div class="content">
            <p>Dear <strong>{candidate_name}</strong>,</p>
            
            <p>Congratulations! You have been selected for an interview for the position of <span class="highlight">{job_title}</span>.</p>
            
            <div class="info-box">
                <h3>📅 Interview Details</h3>
                <ul>
                    <li><strong>Date & Time:</strong> {formatted_datetime}</li>
                    <li><strong>Duration:</strong> {duration_minutes} minutes</li>
                    <li><strong>Interview Type:</strong> AI-Assisted Interview</li>
                    <li><strong>Interview ID:</strong> {interview_id}</li>
                </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{button_link}" class="button" style="background: {button_color}; font-size: 18px;">{button_text}</a>
                <p style="font-size: 12px; color: #888; margin-top: 10px;">{sub_text}</p>
            </div>
            
            <div class="info-box">
                <h3>📌 Important Notes</h3>
                <ul>
                    <li>Click <strong>"Start Interview Now"</strong> button above when ready</li>
                    <li>The <strong>AI interviewer bot will automatically join</strong> the meeting</li>
                    <li>Please join <strong>5 minutes before</strong> the scheduled time</li>
                    <li>Ensure you have a <strong>stable internet connection</strong></li>
                    <li>Test your <strong>microphone and camera</strong> beforehand</li>
                    <li>Be prepared to discuss your <strong>experience and skills</strong></li>
                </ul>
            </div>
            
            <p>If you need to reschedule or have any questions, please contact us immediately.</p>
            
            <p><strong>Best of luck with your interview!</strong> 🍀</p>
            
            <p>Best Regards,<br><strong>HR Team</strong></p>
        </div>
        <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>Interview ID: {interview_id}</p>
        </div>
    </div>
</body>
</html>
            """
            
            # Plain text fallback
            text_body = f"""
Dear {candidate_name},

Congratulations! You have been selected for an interview for the position of {job_title}.

INTERVIEW DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Date & Time: {formatted_datetime}
Duration: {duration_minutes} minutes
Interview Type: AI-Assisted Interview
Interview ID: {interview_id}

JOIN LINK:
{meet_link}

IMPORTANT NOTES:
• Please join 5 minutes before the scheduled time
• Ensure you have a stable internet connection
• Test your microphone and camera beforehand
• This is an AI-assisted interview - the AI interviewer will guide you
• Be prepared to discuss your experience and skills

If you need to reschedule or have any questions, please contact us immediately.

Best of luck with your interview!

Best Regards,
HR Team

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is an automated message. Please do not reply to this email.
Interview ID: {interview_id}
            """
            
            # Create message
            msg = MIMEMultipart('alternative')
            msg['From'] = self.sender_email
            msg['To'] = to_email
            msg['Subject'] = subject
            
            # Attach both plain text and HTML
            msg.attach(MIMEText(text_body, 'plain'))
            msg.attach(MIMEText(html_body, 'html'))
            
            # Send email
            logger.info(f"📤 Connecting to SMTP server: {self.smtp_server}:{self.smtp_port}")
            
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                logger.info("🔐 Logging in to SMTP server...")
                server.login(self.smtp_username, self.smtp_password)
                
                logger.info(f"📨 Sending email to {to_email}...")
                server.send_message(msg)
            
            logger.info(f"✅ Email sent successfully to {to_email}")
            
            # Log email in MongoDB
            try:
                self.email_repo.log_email(
                    recipient_email=to_email,
                    recipient_name=candidate_name,
                    subject=subject,
                    body=text_body,
                    email_type="interview_invite",
                    interview_id=interview_id,
                    status="sent",
                    metadata={
                        "interview_id": interview_id,
                        "job_title": job_title,
                        "candidate_name": candidate_name,
                        "meet_link": meet_link
                    }
                )
                logger.info("💾 Email logged in MongoDB")
            except Exception as log_error:
                logger.warning(f"⚠️ Failed to log email in MongoDB: {str(log_error)}")
            
            return {
                "success": True,
                "message": f"Interview invitation sent to {to_email}",
                "details": {
                    "recipient": to_email,
                    "subject": subject,
                    "sent_at": datetime.utcnow().isoformat()
                }
            }
            
        except smtplib.SMTPAuthenticationError as e:
            error_msg = "SMTP authentication failed. Check username/password."
            logger.error(f"❌ {error_msg}: {str(e)}")
            return {
                "success": False,
                "error": error_msg,
                "message": "Failed to authenticate with email server"
            }
            
        except smtplib.SMTPException as e:
            error_msg = f"SMTP error: {str(e)}"
            logger.error(f"❌ {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "message": "Failed to send email"
            }
            
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            logger.error(f"❌ {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "message": "Email sending failed"
            }

    def send_ai_interview_link(
        self,
        to_email: str,
        candidate_name: str,
        job_title: str,
        interview_url: str,
        expires_at: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send single-use AI Interview invitation link to candidate.
        Returns honest status and error messaging (never marks sent if SMTP fails).
        """
        logger.info(f"📧 Preparing AI Interview invitation for {to_email} ({candidate_name})")
        subject = f"🎯 Interview Invitation: {job_title} at {self.company_name}"
        expiry_display = expires_at if expires_at else "Valid for 48 hours"

        # Check SMTP configuration
        config_status = self.validate_configuration()
        if not config_status.get("configured", False):
            error_msg = f"SMTP credentials not configured on server (missing: {', '.join(config_status.get('missing', []))})"
            logger.error(f"❌ {error_msg}")
            return {
                "success": False,
                "status": "failed",
                "error": error_msg,
                "message": "Email delivery failed: SMTP credentials are not configured on the server."
            }

        # Plain text body
        plain_text = f"""Hello {candidate_name},

You have been invited to complete your AI Technical Interview for the {job_title} position at {self.company_name}.

ASSESSMENT DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Position: {job_title}
Organization: {self.company_name}
Link Expiry: {expiry_display}
Assessment Link: {interview_url}

IMPORTANT CANDIDATE INSTRUCTIONS:
1. Browser: Use the latest version of Google Chrome or Microsoft Edge on a laptop or desktop.
2. Hardware: Enable camera and microphone permissions when prompted for audio/video responses.
3. Environment: Find a quiet, well-lit space with a stable internet connection.
4. Security: This is a private, single-use link. Once you submit the assessment, the link will automatically expire.

If you have questions or experience technical difficulties, please reach out to your recruiter.

Best regards,
{self.company_name} Recruitment Team
"""

        # HTML body
        html_body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Interview Invitation</title>
  <style>
    body {{
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f1f5f9;
      color: #0f172a;
      line-height: 1.6;
    }}
    .wrapper {{
      width: 100%;
      background-color: #f1f5f9;
      padding: 32px 16px;
      box-sizing: border-box;
    }}
    .container {{
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
    }}
    .header {{
      background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
      padding: 32px 24px;
      text-align: center;
      color: #ffffff;
    }}
    .header h1 {{
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }}
    .header p {{
      margin: 6px 0 0 0;
      font-size: 14px;
      opacity: 0.9;
    }}
    .content {{
      padding: 32px 28px;
    }}
    .info-card {{
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px 20px;
      margin: 20px 0;
    }}
    .info-row {{
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px solid #edf2f7;
      font-size: 13px;
    }}
    .info-row:last-child {{
      border-bottom: none;
    }}
    .info-label {{
      color: #64748b;
      font-weight: 600;
    }}
    .info-value {{
      color: #0f172a;
      font-weight: 600;
    }}
    .btn-container {{
      text-align: center;
      margin: 28px 0;
    }}
    .btn {{
      display: inline-block;
      background: #2563eb;
      color: #ffffff !important;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 10px;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.3);
    }}
    .instructions {{
      background: #eff6ff;
      border-left: 4px solid #2563eb;
      padding: 14px 18px;
      border-radius: 6px;
      margin: 24px 0;
    }}
    .instructions h4 {{
      margin: 0 0 8px 0;
      font-size: 13px;
      color: #1e3a8a;
    }}
    .instructions ul {{
      margin: 0;
      padding-left: 18px;
      font-size: 12px;
      color: #334155;
    }}
    .instructions li {{
      margin-bottom: 4px;
    }}
    .footer {{
      padding: 20px 28px;
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
      color: #94a3b8;
      text-align: center;
    }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>AI Technical Interview Invitation</h1>
        <p>{self.company_name}</p>
      </div>
      <div class="content">
        <p>Dear <strong>{candidate_name}</strong>,</p>
        <p>You have been invited by the recruitment team at <strong>{self.company_name}</strong> to complete your autonomous technical assessment for the <strong>{job_title}</strong> role.</p>
        
        <div class="info-card">
          <table style="width:100%; border-collapse: collapse; font-size: 13px;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Position</td>
              <td style="padding: 6px 0; text-align: right; color: #0f172a; font-weight: 700;">{job_title}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Company</td>
              <td style="padding: 6px 0; text-align: right; color: #0f172a; font-weight: 700;">{self.company_name}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Link Expiry</td>
              <td style="padding: 6px 0; text-align: right; color: #dc2626; font-weight: 600;">{expiry_display}</td>
            </tr>
          </table>
        </div>

        <div class="btn-container">
          <a href="{interview_url}" class="btn" target="_blank" rel="noopener noreferrer">Start Interview Now &rarr;</a>
        </div>

        <div class="instructions">
          <h4>Candidate Checklist:</h4>
          <ul>
            <li><strong>Browser:</strong> Use Google Chrome or Microsoft Edge on a laptop or desktop.</li>
            <li><strong>Permissions:</strong> Grant camera and microphone access when prompted.</li>
            <li><strong>Quiet Space:</strong> Choose a quiet, well-lit environment with reliable internet.</li>
            <li><strong>Single-Use Link:</strong> This link is private and will lock permanently once you submit your session.</li>
          </ul>
        </div>

        <p style="font-size: 12px; color: #64748b; margin-top: 16px;">
          Direct link URL (if button does not open):<br>
          <a href="{interview_url}" style="color: #2563eb; word-break: break-all;">{interview_url}</a>
        </p>

        <p style="margin-top: 24px; font-size: 14px;">
          Best of luck with your interview!<br>
          <strong>{self.company_name} Talent Acquisition</strong>
        </p>
      </div>
      <div class="footer">
        Confidential Invitation &bull; Automated message from {self.company_name} Interview Agent.
      </div>
    </div>
  </div>
</body>
</html>"""

        try:
            msg = MIMEMultipart('alternative')
            from_header = f"{self.company_name} <{self.sender_email}>" if self.sender_email else self.company_name
            msg['From'] = from_header
            msg['To'] = to_email
            msg['Subject'] = subject

            msg.attach(MIMEText(plain_text, 'plain', 'utf-8'))
            msg.attach(MIMEText(html_body, 'html', 'utf-8'))

            logger.info(f"📤 Connecting to SMTP server {self.smtp_server}:{self.smtp_port}...")
            with smtplib.SMTP(self.smtp_server, self.smtp_port, timeout=12) as server:
                server.starttls()
                server.login(self.smtp_username, self.smtp_password)
                server.send_message(msg)

            sent_at = datetime.utcnow().isoformat()
            logger.info(f"✅ AI Interview email delivered successfully to {to_email}")

            # Optional DB logging
            try:
                self.email_repo.log_email(
                    recipient_email=to_email,
                    recipient_name=candidate_name,
                    subject=subject,
                    body=plain_text,
                    email_type="interview_invite",
                    interview_id=interview_url.split("/")[-1],
                    status="sent",
                    metadata={
                        "job_title": job_title,
                        "candidate_name": candidate_name,
                        "interview_url": interview_url,
                        "expires_at": expires_at
                    }
                )
            except Exception:
                pass

            return {
                "success": True,
                "status": "sent",
                "message": f"Invitation email delivered to {to_email}",
                "recipient": to_email,
                "sent_at": sent_at
            }

        except smtplib.SMTPAuthenticationError as e:
            error_msg = "SMTP authentication failed. Please verify SMTP_USER and SMTP_PASSWORD/App Password."
            logger.error(f"❌ {error_msg}: {e}")
            return {
                "success": False,
                "status": "failed",
                "error": error_msg,
                "message": error_msg
            }
        except smtplib.SMTPConnectError as e:
            error_msg = f"Cannot reach the SMTP mail server ({self.smtp_server}:{self.smtp_port})."
            logger.error(f"❌ {error_msg}: {e}")
            return {
                "success": False,
                "status": "failed",
                "error": error_msg,
                "message": error_msg
            }
        except smtplib.SMTPRecipientsRefused as e:
            error_msg = f"Recipient email address rejected by server: {to_email}"
            logger.error(f"❌ {error_msg}: {e}")
            return {
                "success": False,
                "status": "failed",
                "error": error_msg,
                "message": error_msg
            }
        except Exception as e:
            err_str = str(e)
            if "getaddrinfo failed" in err_str or "timed out" in err_str:
                error_msg = f"Cannot reach the SMTP mail server ({self.smtp_server}): connection timed out."
            else:
                error_msg = f"Failed to send email: {err_str}"
            logger.error(f"❌ {error_msg}")
            return {
                "success": False,
                "status": "failed",
                "error": error_msg,
                "message": error_msg
            }
