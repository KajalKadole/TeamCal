from app import db
from flask_login import UserMixin
from datetime import datetime
from sqlalchemy.sql import func

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    default_start_time = db.Column(db.String(5), default='09:00')  # Format: HH:MM
    default_end_time = db.Column(db.String(5), default='17:00')    # Format: HH:MM
    created_at = db.Column(db.DateTime, default=func.now())
    
    # Relationships
    availability_slots = db.relationship('AvailabilitySlot', backref='user', lazy=True, cascade='all, delete-orphan')
    busy_slots = db.relationship('BusySlot', backref='user', lazy=True, cascade='all, delete-orphan')
    leave_days = db.relationship('LeaveDay', backref='user', lazy=True, cascade='all, delete-orphan')
    
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
