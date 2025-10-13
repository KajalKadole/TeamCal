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


def send_email(to_email, subject, html_content, email_type=None, reference_id=None):
    
    try:
        # Create message
        msg = MIMEMultipart('alternative')
        msg['From'] = FROM_EMAIL
        msg['To'] = to_email
        msg['Subject'] = subject
        
        # Attach HTML content
        html_part = MIMEText(html_content, 'html')
        msg.attach(html_part)
        
        # Send email
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            if SMTP_USERNAME and SMTP_PASSWORD:
                server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
        
        print(f"Email sent successfully to {to_email}")
        return True, None
        
    except Exception as e:
        error_msg = str(e)
        print(f"Error sending email to {to_email}: {error_msg}")
        return False, error_msg


def render_template(template_str, **context):
    """Simple template rendering (replace {{ var }} with values)"""
    result = template_str
    for key, value in context.items():
        placeholder = '{{ ' + key + ' }}'
        result = result.replace(placeholder, str(value) if value is not None else '')
    
    # Handle if statements
    import re
    # Remove {% if var %} blocks when var is None or False
    for key, value in context.items():
        if not value:
            pattern = r'\{% if ' + key + r' %\}.*?\{% endif %\}'
            result = re.sub(pattern, '', result, flags=re.DOTALL)
        else:
            result = result.replace('{% if ' + key + ' %}', '')
            result = result.replace('{% endif %}', '')
    
    return result


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
            if isinstance(leave_request.user, dict):
               employee_name = leave_request.user.get('username', 'Unknown')
               employee_email = leave_request.user.get('email', 'unknown@example.com')
            else:
               employee_name = getattr(leave_request.user, 'username', 'Unknown')
               employee_email = getattr(leave_request.user, 'email', 'unknown@example.com')
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
            html_content = render_template(
                LEAVE_REQUEST_TEMPLATE,
                company_name=COMPANY_NAME,
                recipient_name=employee_name,
                employee_name='Kajal',
                employee_email='kajalskadole888@gmail.com',
                leave_type=leave_request.leave_type,
                start_date=leave_request.start_date.strftime('%d %B %Y'),
                end_date=leave_request.end_date.strftime('%d %B %Y'),
                reason=leave_request.notes or 'Not specified',
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
        leave_request: LeaveDay object
        status: 'approved' or 'rejected'
        comments: Optional comments from approver
    """
    try:
        status_text = 'Approved' if status == 'approved' else 'Rejected'
        status_class = 'approved' if status == 'approved' else 'rejected'
        
        # Calculate total days
        total_days = (leave_request.end_date - leave_request.start_date).days + 1
        
        html_content = render_template(
            LEAVE_STATUS_UPDATE_TEMPLATE,
            company_name=COMPANY_NAME,
            employee_name=leave_request.user.username,
            status=status,
            status_text=status_text,
            status_class=status_class,
            leave_type=leave_request.leave_type,
            start_date=leave_request.start_date.strftime('%d %B %Y'),
            end_date=leave_request.end_date.strftime('%d %B %Y'),
            total_days=total_days,
            comments=comments
        )
        
        subject = f"Your Leave Request has been {status_text}"
        
        success, error = send_email(
            leave_request.user.email,
            subject,
            html_content,
            email_type='leave_status_update',
            reference_id=leave_request.id
        )
        
        if not success:
            print(f"Failed to send status update email: {error}")
            
    except Exception as e:
        print(f"Error in send_leave_status_update: {e}")
        import traceback
        traceback.print_exc()




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



def log_email(recipient, subject, body, email_type, reference_id, status, error_message=None):
    """Log email to database"""
    try:
        from app import db
        from models import EmailLog
        
        email_log = EmailLog(
            recipient=recipient,
            subject=subject,
            body=body[:500],  # Store first 500 chars
            email_type=email_type,
            reference_id=reference_id,
            status=status,
            error_message=error_message
        )
        db.session.add(email_log)
        db.session.commit()
    except Exception as e:
        print(f"Error logging email: {e}")



def send_leave_status_update(leave_request, status, comments=None):
    """
    Send leave status update to employee
    
    Args:
        leave_request: LeaveRequest object
        status: 'approved' or 'rejected'
        comments: Optional comments from approver
    """
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
    
    send_email(
        leave_request.user.email,
        subject,
        html_content,
        email_type='leave_status_update',
        reference_id=leave_request.id
    )


def send_invoice_approval_notification(invoice, recipient):
    """
    Send invoice approval notification to manager or accounts
    
    Args:
        invoice: Invoice object
        recipient: User object (Manager or Accounts)
    """
    html_content = render_template_string(
        INVOICE_APPROVAL_TEMPLATE,
        company_name=COMPANY_NAME,
        recipient_name=recipient.username,
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
    
    send_email(
        recipient.email,
        subject,
        html_content,
        email_type='invoice_approval',
        reference_id=invoice.id
    )