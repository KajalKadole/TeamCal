import os
import logging

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from sqlalchemy.orm import DeclarativeBase
from werkzeug.middleware.proxy_fix import ProxyFix

# Configure logging
logging.basicConfig(level=logging.DEBUG)

class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)
login_manager = LoginManager()

# create the app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key-change-in-production")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# configure the database
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", "sqlite:///team_calendar.db")
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}

# initialize extensions
db.init_app(app)
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Please log in to access this page.'
login_manager.login_message_category = 'info'

@login_manager.user_loader
def load_user(user_id):
    from models import User
    return User.query.get(int(user_id))

with app.app_context():
    # Import models to ensure tables are created
    import models
    db.create_all()
    
    # Create default departments if they don't exist
    from models import Department
    departments_data = [
        {'name': 'Engineering', 'description': 'Software development and technical teams'},
        {'name': 'Marketing', 'description': 'Marketing and communications team'},
        {'name': 'Sales', 'description': 'Sales and business development team'},
        {'name': 'Human Resources', 'description': 'HR and people operations team'},
        {'name': 'Operations', 'description': 'Operations and logistics team'}
    ]
    
    for dept_data in departments_data:
        existing_dept = Department.query.filter_by(name=dept_data['name']).first()
        if not existing_dept:
            dept = Department(name=dept_data['name'], description=dept_data['description'])
            db.session.add(dept)
    
    db.session.commit()
    
    # Create admin user if it doesn't exist
    from models import User
    from werkzeug.security import generate_password_hash
    
    admin = User.query.filter_by(email='admin@teamcal.com').first()
    if not admin:
        # Get Engineering department for admin user
        engineering_dept = Department.query.filter_by(name='Engineering').first()
        admin_user = User(
            username='admin',
            email='admin@teamcal.com',
            password_hash=generate_password_hash('admin123'),
            is_admin=True,
            approval_status='approved',  # Admin is automatically approved
            department_id=engineering_dept.id if engineering_dept else None
        )
        db.session.add(admin_user)
        db.session.commit()
        print("Admin user created: admin@teamcal.com / admin123")

# Add template filters for timezone conversion
from utils.timezone_helper import convert_utc_to_user_timezone, format_datetime_for_user
from flask_login import current_user

@app.template_filter('user_timezone')
def user_timezone_filter(utc_datetime):
    """Template filter to convert UTC datetime to user's timezone"""
    if not utc_datetime:
        return ''
    try:
        user_datetime = convert_utc_to_user_timezone(utc_datetime)
        return user_datetime.strftime('%Y-%m-%d %H:%M:%S')
    except:
        return utc_datetime.strftime('%Y-%m-%d %H:%M:%S') if utc_datetime else ''

@app.template_filter('user_time')
def user_time_filter(utc_datetime):
    """Template filter to show just time in user's timezone"""
    if not utc_datetime:
        return ''
    try:
        user_datetime = convert_utc_to_user_timezone(utc_datetime)
        return user_datetime.strftime('%H:%M:%S')
    except:
        return utc_datetime.strftime('%H:%M:%S') if utc_datetime else ''

@app.template_filter('user_date')
def user_date_filter(utc_datetime):
    """Template filter to show just date in user's timezone"""
    if not utc_datetime:
        return ''
    try:
        user_datetime = convert_utc_to_user_timezone(utc_datetime)
        return user_datetime.strftime('%Y-%m-%d')
    except:
        return utc_datetime.strftime('%Y-%m-%d') if utc_datetime else ''

# Import routes after app initialization
import routes
