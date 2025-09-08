from app import db
from flask_login import UserMixin
from datetime import datetime
from sqlalchemy.sql import func

class Department(db.Model):
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
    default_start_time = db.Column(db.String(5), default='09:00')  # Format: HH:MM
    default_end_time = db.Column(db.String(5), default='17:00')    # Format: HH:MM
    timezone = db.Column(db.String(50), default='UTC')  # User's timezone (e.g., 'Asia/Kolkata', 'Europe/Berlin', 'Europe/London')
    created_at = db.Column(db.DateTime, default=func.now())
    
    # Relationships
    availability_slots = db.relationship('AvailabilitySlot', backref='user', lazy=True, cascade='all, delete-orphan')
    busy_slots = db.relationship('BusySlot', backref='user', lazy=True, cascade='all, delete-orphan')
    leave_days = db.relationship('LeaveDay', backref='user', lazy=True, cascade='all, delete-orphan')
    timesheet_entries = db.relationship('TimesheetEntry', backref='user', lazy=True, cascade='all, delete-orphan')
    user_status = db.relationship('UserStatus', backref='user', lazy=True, uselist=False, cascade='all, delete-orphan')
    
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
    date = db.Column(db.Date, nullable=False)
    leave_type = db.Column(db.String(20), default='Leave')  # Leave, Vacation, Sick, etc.
    notes = db.Column(db.Text)
    approved = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=func.now())
    
    def __repr__(self):
        return f'<LeaveDay {self.user.username} {self.date} {self.leave_type}>'

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
