
from flask_login import UserMixin
from datetime import datetime
from sqlalchemy.sql import func
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from sqlalchemy.orm import DeclarativeBase


db = SQLAlchemy()
login_manager = LoginManager()


class Invoice(db.Model):
    """Invoice with approval workflow"""
    __tablename__ = 'invoices'
    
    id = db.Column(db.Integer, primary_key=True)
    invoice_number = db.Column(db.String(50), unique=True, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    
    # Invoice details
    invoice_date = db.Column(db.Date, nullable=False)
    period_start = db.Column(db.Date, nullable=False)
    period_end = db.Column(db.Date, nullable=False)
    
    # Financial details
    total_hours = db.Column(db.Float, default=0)
    hourly_rate = db.Column(db.Float)
    overtime_hours = db.Column(db.Float, default=0)
    overtime_rate = db.Column(db.Float)
    subtotal = db.Column(db.Float, default=0)
    tax_amount = db.Column(db.Float, default=0)
    total_amount = db.Column(db.Float, default=0)
    
    # Notes and attachments
    notes = db.Column(db.Text)
    attachment_path = db.Column(db.String(255))
    
    # Approval workflow
    status = db.Column(db.String(20), default='draft')  # draft, pending, manager_approved, accounts_approved, rejected, paid
    submitted_at = db.Column(db.DateTime)
    
    # Manager approval
    manager_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    manager_status = db.Column(db.String(20), default='pending')
    manager_comments = db.Column(db.Text)
    manager_reviewed_at = db.Column(db.DateTime)
    
    # Accounts approval
    accounts_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    accounts_status = db.Column(db.String(20), default='pending')
    accounts_comments = db.Column(db.Text)
    accounts_reviewed_at = db.Column(db.DateTime)
    
    # Payment details
    payment_date = db.Column(db.Date)
    payment_method = db.Column(db.String(50))
    payment_reference = db.Column(db.String(100))
    
    # Relationships
    user = db.relationship('User', foreign_keys=[user_id], backref='invoices')
    manager = db.relationship('User', foreign_keys=[manager_id])
    accounts_approver = db.relationship('User', foreign_keys=[accounts_id])
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    @property
    def can_download(self):
        """Check if invoice can be downloaded"""
        return self.status in ['accounts_approved', 'paid']


# Update User model to add manager and role fields
"""
Add these fields to your existing User model:

    # Manager relationship
    manager_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    manager = db.relationship('User', remote_side=[id], backref='team_members')
    
    # Role for approval workflow
    role = db.Column(db.String(50), default='employee')  # employee, manager, hr, accounts
    
    # HR flag
    is_hr = db.Column(db.Boolean, default=False)
    
    # Accounts flag
    is_accounts = db.Column(db.Boolean, default=False)
"""


class EmailLog(db.Model):
    """Log all emails sent for audit trail"""
    __tablename__ = 'email_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    recipient = db.Column(db.String(255), nullable=False)
    subject = db.Column(db.String(255), nullable=False)
    body = db.Column(db.Text)
    email_type = db.Column(db.String(50))  # leave_request, invoice_approval, etc.
    reference_id = db.Column(db.Integer)  # ID of related record
    sent_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default='sent')  # sent, failed
    error_message = db.Column(db.Text)
class Department(db.Model):
    __tablename__='department'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=func.now())
    
    # Relationships
    users = db.relationship('User', backref='department', lazy=True)
    
    def __repr__(self):
        return f'<Department {self.name}>'

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    approval_status = db.Column(db.String(20), default='pending')  # pending, approved, rejected
    approved_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)  # Admin who approved
    approved_at = db.Column(db.DateTime, nullable=True)
    department_id = db.Column(db.Integer, db.ForeignKey('department.id'), nullable=True)  # User's department
    staff_number = db.Column(db.String(20), unique=True, nullable=True)  # Employee staff number
    hourly_rate = db.Column(db.Numeric(10, 2), default=10.00)  # Hourly pay rate
    standard_hours = db.Column(db.Integer, default=40)  # Standard weekly hours
    overtime_rate = db.Column(db.Numeric(10, 2), default=15.00)  # Overtime hourly rate
    default_start_time = db.Column(db.String(5), default='09:00')  # Format: HH:MM
    default_end_time = db.Column(db.String(5), default='17:00')    # Format: HH:MM
    timezone = db.Column(db.String(50), default='UTC')  # User's timezone (e.g., 'Asia/Kolkata', 'Europe/Berlin', 'Europe/London')
    created_at = db.Column(db.DateTime, default=func.now())
    role=db.Column(db.String(20), default='user')
    
    # Relationships
    availability_slots = db.relationship('AvailabilitySlot', backref='user', lazy=True, cascade='all, delete-orphan')
    busy_slots = db.relationship('BusySlot', backref='user', lazy=True, cascade='all, delete-orphan')
    timesheet_entries = db.relationship('TimesheetEntry', backref='user', lazy=True, cascade='all, delete-orphan')
    user_status = db.relationship('UserStatus', backref='user', lazy=True, uselist=False, cascade='all, delete-orphan')
    # Manager relationship (add if not exists)
    manager_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    manager = db.relationship('User', remote_side=[id], backref='team_members', foreign_keys=[manager_id])
    
    # HR flag (add if not exists)
    is_hr = db.Column(db.Boolean, default=False)
    def __repr__(self):
        return f'<User {self.username}>'

class AvailabilitySlot(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    recurring = db.Column(db.Boolean, default=False)
    recurring_days = db.Column(db.String(20))  # JSON string of weekdays [0-6]
    created_at = db.Column(db.DateTime, default=func.now())
    
    def __repr__(self):
        return f'<AvailabilitySlot {self.user.username} {self.date} {self.start_time}-{self.end_time}>'

class BusySlot(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    title = db.Column(db.String(100), default='Busy')
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=func.now())
    
    def __repr__(self):
        return f'<BusySlot {self.user.username} {self.date} {self.start_time}-{self.end_time}>'

class LeaveDay(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    
    leave_type = db.Column(db.String(20), default='Leave')  # Leave, Vacation, Sick, etc.
    notes = db.Column(db.Text)
    total_days = db.Column(db.Integer)
    
    approved = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=func.now())
    approved_status = db.Column(db.String(20), default='pending')  # pending, approved, rejected
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # HR approval
    hr_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    hr_status = db.Column(db.String(20), default='pending')
    hr_reviewed_at = db.Column(db.DateTime)
    hr_comments = db.Column(db.Text)
    
    # Manager approval
    manager_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    manager_status = db.Column(db.String(20), default='pending')
    manager_reviewed_at = db.Column(db.DateTime)
    manager_comments = db.Column(db.Text)
    
    # Relationships - SPECIFY foreign_keys to avoid ambiguity
    user = db.relationship('User', foreign_keys=[user_id], backref='leave_requests')
    hr_reviewer = db.relationship('User', foreign_keys=[hr_id], backref='hr_reviewed_leaves')
    manager_reviewer = db.relationship('User', foreign_keys=[manager_id], backref='manager_reviewed_leaves')
    
    def __repr__(self):
        return f'<LeaveDay {self.user.username} {self.start_date} to {self.end_date} {self.leave_type}>'
    
    @property
    def duration_days(self):
        """Calculate number of days for leave request"""
        if self.start_date and self.end_date:
            return (self.end_date - self.start_date).days + 1
        return 0
    
    @property
    def can_approve(self):
        """Check if leave can be approved"""
        return self.approved_status == 'pending'
    
    @property
    def is_approved(self):
        """Check if leave is fully approved"""
        return self.approved_status == 'approved'
class TimesheetEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    date = db.Column(db.Date, nullable=False, index=True)
    clock_in = db.Column(db.DateTime, nullable=False)
    clock_out = db.Column(db.DateTime, nullable=True)  # Null when still clocked in
    break_duration = db.Column(db.Integer, default=0)  # Break time in minutes
    notes = db.Column(db.Text)
    location = db.Column(db.String(50), default='Office')  # Office, Remote, etc.
    created_at = db.Column(db.DateTime, default=func.now())
    updated_at = db.Column(db.DateTime, default=func.now(), onupdate=func.now())
    
    @property
    def duration(self):
        """Calculate work duration in minutes"""
        if not self.clock_out:
            return 0
        total_minutes = (self.clock_out - self.clock_in).total_seconds() / 60
        return max(0, int(total_minutes - self.break_duration))
    
    @property
    def is_active(self):
        """Check if user is currently clocked in"""
        return self.clock_out is None
    
    def __repr__(self):
        return f'<TimesheetEntry {self.user.username} {self.date} {self.clock_in}-{self.clock_out}>'

class BreakEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    timesheet_entry_id = db.Column(db.Integer, db.ForeignKey('timesheet_entry.id'), nullable=False)
    break_start = db.Column(db.DateTime, nullable=False)
    break_end = db.Column(db.DateTime, nullable=True)  # Null when break is active
    break_type = db.Column(db.String(50), default='Break')  # Break, Lunch, etc.
    created_at = db.Column(db.DateTime, default=func.now())
    updated_at = db.Column(db.DateTime, default=func.now(), onupdate=func.now())
    
    @property
    def duration(self):
        """Calculate break duration in minutes"""
        if not self.break_end:
            # If break is active, calculate from start to now
            return int((datetime.now() - self.break_start).total_seconds() / 60)
        return int((self.break_end - self.break_start).total_seconds() / 60)
    
    @property
    def is_active(self):
        """Check if break is currently active"""
        return self.break_end is None
    
    def __repr__(self):
        return f'<BreakEntry {self.user.username} {self.break_start}-{self.break_end}>'

class UserStatus(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, unique=True)
    is_working = db.Column(db.Boolean, default=False)
    current_task = db.Column(db.String(200))
    status_message = db.Column(db.String(100))  # Available, In Meeting, On Break, etc.
    last_activity = db.Column(db.DateTime, default=func.now())
    current_timesheet_id = db.Column(db.Integer, nullable=True)  # Reference to active timesheet
    updated_at = db.Column(db.DateTime, default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f'<UserStatus {self.user.username} working:{self.is_working}>'
