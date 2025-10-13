"""
Email notification service for leave requests and invoices
Place this file as: utils/email_service.py
"""
from flask import render_template
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from flask import render_template_string

# Email configuration (set these in your environment variables or config)
SMTP_SERVER = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
SMTP_USERNAME = os.environ.get('SMTP_USERNAME', 'kadolekajal4@gmail.com')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', 'vgzb ihfl hjaq gilh')
FROM_EMAIL = os.environ.get('FROM_EMAIL', 'noreply@teamcalendar.com')
COMPANY_NAME = os.environ.get('COMPANY_NAME', 'Ziqsy Team Calendar')

# Email templates
LEAVE_REQUEST_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin-top: 20px; }
        .details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4CAF50; }
        .button { display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
        .button.reject { background-color: #f44336; }
        .footer { text-align: center; margin-top: 20px; color: #777; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>{{ company_name }}</h2>
            <h3>Leave Request Notification</h3>
        </div>
        <div class="content">
            <p>Dear {{ recipient_name }},</p>
            
            <p>A new leave request has been submitted and requires your approval:</p>
            
            <div class="details">
                <p><strong>Employee:</strong> {{ employee_name }} ({{ employee_email }})</p>
                <p><strong>Leave Type:</strong> {{ leave_type }}</p>
                <p><strong>Start Date:</strong> {{ start_date }}</p>
                <p><strong>End Date:</strong> {{ end_date }}</p>
                <p><strong>Total Days:</strong> {{ total_days }}</p>
                <p><strong>Reason:</strong> {{ reason }}</p>
                <p><strong>Submitted On:</strong> {{ submitted_at }}</p>
            </div>
            
            <p style="text-align: center;">
                <a href="{{ approval_link }}" class="button">Review & Approve</a>
            </p>
            
            <p>Please review and take action on this request at your earliest convenience.</p>
        </div>
        <div class="footer">
            <p>This is an automated notification from {{ company_name }}.</p>
            <p>Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>
"""

LEAVE_STATUS_UPDATE_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { padding: 20px; text-align: center; }
        .header.approved { background-color: #4CAF50; color: white; }
        .header.rejected { background-color: #f44336; color: white; }
        .content { background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin-top: 20px; }
        .details { background-color: white; padding: 15px; margin: 15px 0; }
        .footer { text-align: center; margin-top: 20px; color: #777; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header {{ status_class }}">
            <h2>{{ company_name }}</h2>
            <h3>Leave Request {{ status_text }}</h3>
        </div>
        <div class="content">
            <p>Dear {{ employee_name }},</p>
            
            <p>Your leave request has been <strong>{{ status_text }}</strong>.</p>
            
            <div class="details">
                <p><strong>Leave Type:</strong> {{ leave_type }}</p>
                <p><strong>Start Date:</strong> {{ start_date }}</p>
                <p><strong>End Date:</strong> {{ end_date }}</p>
                <p><strong>Total Days:</strong> {{ total_days }}</p>
                {% if comments %}
                <p><strong>Comments:</strong> {{ comments }}</p>
                {% endif %}
            </div>
            
            {% if status == 'approved' %}
            <p>Your leave has been approved and will now appear on the team calendar.</p>
            {% else %}
            <p>If you have any questions, please contact your manager or HR department.</p>
            {% endif %}
        </div>
        <div class="footer">
            <p>This is an automated notification from {{ company_name }}.</p>
        </div>
    </div>
</body>
</html>
"""

INVOICE_APPROVAL_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin-top: 20px; }
        .details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #2196F3; }
        .button { display: inline-block; padding: 10px 20px; background-color: #2196F3; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
        .footer { text-align: center; margin-top: 20px; color: #777; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>{{ company_name }}</h2>
            <h3>Invoice Approval Request</h3>
        </div>
        <div class="content">
            <p>Dear {{ recipient_name }},</p>
            
            <p>A new invoice has been submitted for your approval:</p>
            
            <div class="details">
                <p><strong>Invoice Number:</strong> {{ invoice_number }}</p>
                <p><strong>Employee:</strong> {{ employee_name }}</p>
                <p><strong>Period:</strong> {{ period_start }} to {{ period_end }}</p>
                <p><strong>Total Hours:</strong> {{ total_hours }}</p>
                <p><strong>Total Amount:</strong> ₹{{ total_amount }}</p>
                <p><strong>Submitted On:</strong> {{ submitted_at }}</p>
            </div>
            
            <p style="text-align: center;">
                <a href="{{ approval_link }}" class="button">Review Invoice</a>
            </p>
        </div>
        <div class="footer">
            <p>This is an automated notification from {{ company_name }}.</p>
        </div>
    </div>
</body>
</html>
"""


def send_email(to_email, subject, html_content, email_type=None, reference_id=None, cc=None, bcc=None):
    """
    Send email using SMTP
    
    Args:
        to_email: Recipient email address (string or list)
        subject: Email subject
        html_content: HTML content of the email
        email_type: Type of email for logging
        reference_id: ID of related record
        cc: CC email address(es) - string or list (optional)
        bcc: BCC email address(es) - string or list (optional)
    
    Returns:
        tuple: (success: bool, error_message: str or None)
    """
    try:
        # Validate email configuration
        if not SMTP_USERNAME or not SMTP_PASSWORD:
            raise ValueError("SMTP credentials not configured. Please set SMTP_USERNAME and SMTP_PASSWORD environment variables.")
        
        if not to_email:
            raise ValueError("Recipient email address is required.")
        
        # Convert single emails to lists for uniform handling
        to_list = [to_email] if isinstance(to_email, str) else to_email
        cc_list = []
        bcc_list = []
        
        if cc:
            cc_list = [cc] if isinstance(cc, str) else cc
        if bcc:
            bcc_list = [bcc] if isinstance(bcc, str) else bcc
        
        # Create message
        msg = MIMEMultipart('alternative')
        msg['From'] = FROM_EMAIL
        msg['To'] = ', '.join(to_list)
        msg['Subject'] = subject
        
        # Add CC header (visible to all recipients)
        if cc_list:
            msg['Cc'] = ', '.join(cc_list)
        
        # BCC is NOT added to headers (hidden from recipients)
        
        # Attach HTML content
        html_part = MIMEText(html_content, 'html')
        msg.attach(html_part)
        
        # Combine all recipients for actual sending
        all_recipients = to_list + cc_list + bcc_list
        
        # Send email
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(FROM_EMAIL, all_recipients, msg.as_string())
        
        # Log successful email
        log_email(', '.join(to_list), subject, html_content, email_type, reference_id, 'sent')
        
        return True, None
        
    except Exception as e:
        error_msg = str(e)
        recipient_str = to_email if isinstance(to_email, str) else ', '.join(to_email)
        print(f"Error sending email to {recipient_str}: {error_msg}")
        # Log failed email
        log_email(recipient_str, subject, html_content, email_type, reference_id, 'failed', error_msg)
        return False, error_msg

def log_email(recipient, subject, body, email_type, reference_id, status, error_message=None):
    """Log email to database"""
    try:
        from app import db
        from models import EmailLog
        
        email_log = EmailLog(
            recipient=recipient,
            subject=subject,
            body=body[:500] if body else '',  # Store first 500 chars
            email_type=email_type,
            reference_id=reference_id,
            status=status,
            error_message=error_message
        )
        db.session.add(email_log)
        db.session.commit()
    except Exception as e:
        print(f"Error logging email: {e}")


def send_leave_request_notification(leave_request, recipients):
    """
    Send leave request notification to HR and Manager
    
    Args:
        leave_request: LeaveDay object
        recipients: List of User objects (HR and Manager)
    """
    try:
        
        # Calculate total days
        total_days = (leave_request.end_date - leave_request.start_date).days + 1
        
        for recipient in recipients:
            # Safely handle both User object and dict for the employee
            if isinstance(recipient, dict):
               employee_name = recipient.get('username', 'Unknown')
               employee_email = recipient.get('email', 'unknown@example.com')
            else:
               employee_name = getattr(recipient, 'username', 'Unknown')
               employee_email = getattr(recipient, 'email', 'unknown@example.com')
            if isinstance(leave_request.user, dict):
                employee_name2 = leave_request.user.get('username', 'Unknown')
                employee_email2 = leave_request.user.get('email', 'unknown@example.com')
            else:
                employee_name2 = getattr(leave_request.user, 'username', 'Unknown')
                employee_email2 = getattr(leave_request.user, 'email', 'unknown@example.com')

            if not employee_email:
                print(f"No email address for recipient: {employee_email}")
                continue
            # Prepare email content
            html_content = render_template_string(
                LEAVE_REQUEST_TEMPLATE,
                company_name=COMPANY_NAME,
                recipient_name=employee_name,
                employee_name=employee_name2,
                employee_email=employee_email2,
                leave_type=leave_request.leave_type,
                start_date=leave_request.start_date.strftime('%d %B %Y'),
                end_date=leave_request.end_date.strftime('%d %B %Y'),
                reason=leave_request.notes or 'Not specified',
                total_days=leave_request.total_days,
                submitted_at=leave_request.submitted_at.strftime('%d %B %Y at %I:%M %p') if leave_request.submitted_at else datetime.utcnow().strftime('%d %B %Y at %I:%M %p'),
                approval_link=f"{os.environ.get('APP_URL', 'http://localhost:5000')}/leave-requests"
            )
            
            subject = f"Leave Request from {leave_request.user.username} - Action Required"
            
            success, error = send_email(
                employee_email,
                subject,
                html_content,
                email_type='leave_request',
                reference_id=leave_request.id
            )
            
            if not success:
                print(f"Failed to send email to {employee_email}: {error}")
                
    except Exception as e:
        print(f"Error in send_leave_request_notification: {e}")
        import traceback
        traceback.print_exc()


def send_leave_status_update(leave_request, status, comments=None):
    """
    Send leave status update to employee
    
    Args:
        leave_request: LeaveRequest object
        status: 'approved' or 'rejected'
        comments: Optional comments from approver
    
    Returns:
        tuple: (success: bool, error_message: str or None)
    """
    try:
        status_text = 'Approved' if status == 'approved' else 'Rejected'
        status_class = 'approved' if status == 'approved' else 'rejected'
        
        html_content = render_template_string(
            LEAVE_STATUS_UPDATE_TEMPLATE,
            company_name=COMPANY_NAME,
            employee_name=leave_request.user.username,
            status=status,
            status_text=status_text,
            status_class=status_class,
            leave_type=leave_request.leave_type,
            start_date=leave_request.start_date.strftime('%d %B %Y'),
            end_date=leave_request.end_date.strftime('%d %B %Y'),
            total_days=leave_request.total_days,
            comments=comments
        )
        
        subject = f"Your Leave Request has been {status_text}"
        
        return send_email(
            leave_request.user.email,
            subject,
            html_content,
            email_type='leave_status_update',
            reference_id=leave_request.id
        )
    except Exception as e:
        error_msg = f"Error sending leave status update: {str(e)}"
        print(error_msg)
        return False, error_msg


def send_invoice_approval_notification(invoice, recipient):
    """
    Send invoice approval notification to manager or accounts
    
    Args:
        invoice: Invoice object
        recipient: User object (Manager or Accounts)
    
    Returns:
        tuple: (success: bool, error_message: str or None)
    """
    try:
        html_content = render_template_string(
            INVOICE_APPROVAL_TEMPLATE,
            company_name=COMPANY_NAME,
            recipient_name=recipient.username if hasattr(recipient, 'username') else 'User',
            invoice_number=invoice.invoice_number,
            employee_name=invoice.user.username,
            period_start=invoice.period_start.strftime('%d %B %Y'),
            period_end=invoice.period_end.strftime('%d %B %Y'),
            total_hours=invoice.total_hours,
            total_amount=f"{invoice.total_amount:,.2f}",
            submitted_at=invoice.submitted_at.strftime('%d %B %Y at %I:%M %p'),
            approval_link=f"{os.environ.get('APP_URL', 'http://localhost:5000')}/invoices/{invoice.id}"
        )
        
        subject = f"Invoice {invoice.invoice_number} - Approval Required"
        
        return send_email(
            recipient.email,
            subject,
            html_content,
            email_type='invoice_approval',
            reference_id=invoice.id
        )
    except Exception as e:
        error_msg = f"Error sending invoice approval notification: {str(e)}"
        print(error_msg)
        return False, error_msg