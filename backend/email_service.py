import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from config import SMTP_SERVER, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_SENDER, SMTP_USE_TLS
except ModuleNotFoundError:
    from backend.config import SMTP_SERVER, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_SENDER, SMTP_USE_TLS


logger = logging.getLogger("uvicorn.error")

def send_profile_update_email(employee_name: str, employee_email: str, employee_id: str, score: int) -> bool:
    """
    Sends a profile update reminder email to an employee.
    If SMTP_SERVER is not configured, runs in Mail Simulation mode and logs email.
    """
    subject = "Action Required: Update Your SkillPulse Profile"
    
    body_text = f"""Hi {employee_name},

It has been over 6 months since you last updated your SkillPulse profile. 
To ensure your skills, certifications, and project details are accurate and up to date, please log in to the portal and update your profile.

Your current profile score: {score}%
(Keeping your profile updated helps maintain a high Score.)

Portal Link: https://employee-skillpulse.onrender.com/  

Thank you,
Arohak Admin Team
"""
    
    # Check if we should run in mock/simulation mode
    if not SMTP_SERVER:
        logger.info(f"[MAIL SIMULATION] Sent profile update reminder to {employee_name} ({employee_email}) - ID: {employee_id}, Current Score: {score}%")
        return True

    try:
        msg = MIMEMultipart()
        msg['From'] = SMTP_SENDER
        msg['To'] = employee_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body_text, 'plain'))

        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        if SMTP_USE_TLS:
            server.starttls()
        if SMTP_USERNAME and SMTP_PASSWORD:
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
        
        server.sendmail(SMTP_SENDER, employee_email, msg.as_string())
        server.quit()
        logger.info(f"Successfully sent profile update email to {employee_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {employee_email}: {str(e)}")
        return False
