import pytz
from datetime import datetime
from flask_login import current_user

# Supported timezones mapping
SUPPORTED_TIMEZONES = {
    'UTC': 'UTC',
    'Asia/Kolkata': 'India Standard Time (IST)',
    'Europe/Berlin': 'Central European Time (CET)',
    'Europe/London': 'Greenwich Mean Time (GMT)'
}

def get_user_timezone():
    """Get the current user's timezone, defaulting to Asia/Kolkata for Indian users"""
    if hasattr(current_user, 'timezone') and current_user.timezone:
        # If user explicitly set UTC, respect it, otherwise default to IST
        if current_user.timezone == 'UTC':
            return 'Asia/Kolkata'  # Override UTC default to IST
        return current_user.timezone
    return 'Asia/Kolkata'  # Default to IST instead of UTC

def convert_utc_to_user_timezone(utc_datetime, user_timezone=None):
    """Convert UTC datetime to user's timezone"""
    if not utc_datetime:
        return None
    
    if user_timezone is None:
        user_timezone = get_user_timezone()
    
    # Ensure datetime is timezone-aware (UTC)
    if utc_datetime.tzinfo is None:
        utc_datetime = pytz.UTC.localize(utc_datetime)
    
    # Convert to user's timezone
    user_tz = pytz.timezone(user_timezone)
    return utc_datetime.astimezone(user_tz)

def convert_user_timezone_to_utc(local_datetime, user_timezone=None):
    """Convert user's local datetime to UTC"""
    if not local_datetime:
        return None
    
    if user_timezone is None:
        user_timezone = get_user_timezone()
    
    # Localize the datetime to user's timezone
    user_tz = pytz.timezone(user_timezone)
    if local_datetime.tzinfo is None:
        local_datetime = user_tz.localize(local_datetime)
    
    # Convert to UTC
    return local_datetime.astimezone(pytz.UTC)

def get_current_time_in_user_timezone(user_timezone=None):
    """Get current time in user's timezone"""
    if user_timezone is None:
        user_timezone = get_user_timezone()
    
    utc_now = datetime.utcnow()
    return convert_utc_to_user_timezone(utc_now, user_timezone)

def format_datetime_for_user(utc_datetime, format_str='%Y-%m-%d %H:%M:%S', user_timezone=None):
    """Format datetime in user's timezone"""
    if not utc_datetime:
        return ''
    
    user_datetime = convert_utc_to_user_timezone(utc_datetime, user_timezone)
    return user_datetime.strftime(format_str)

def get_timezone_display_name(timezone_key):
    """Get display name for timezone"""
    return SUPPORTED_TIMEZONES.get(timezone_key, timezone_key)

def detect_timezone_from_offset(offset_minutes):
    """Detect timezone from browser offset (rough estimation)"""
    # Convert minutes to hours
    offset_hours = -offset_minutes / 60  # Browser offset is negative of UTC offset
    
    # Map common offsets to timezones
    timezone_map = {
        0: 'UTC',           # GMT/UTC
        1: 'Europe/Berlin', # CET
        5.5: 'Asia/Kolkata' # IST
    }
    
    return timezone_map.get(offset_hours, 'UTC')