import os
from flask import Flask
from werkzeug.middleware.proxy_fix import ProxyFix

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key-change-in-production")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", "sqlite:///team_calendar.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Initialize extensions
from models import db, login_manager
db.init_app(app)
login_manager.init_app(app)
login_manager.login_view = 'main.login'
login_manager.login_message = 'Please log in to access this page.'

@login_manager.user_loader
def load_user(user_id):
    from models import User
    return User.query.get(int(user_id))

# Template filters
@app.template_filter('user_timezone')
def user_timezone_filter(utc_datetime):
    if not utc_datetime:
        return ''
    try:
        from utils.timezone_helper import convert_utc_to_user_timezone
        return convert_utc_to_user_timezone(utc_datetime).strftime('%Y-%m-%d %H:%M:%S')
    except:
        return utc_datetime.strftime('%Y-%m-%d %H:%M:%S') if utc_datetime else ''

@app.template_filter('user_time')
def user_time_filter(utc_datetime):
    if not utc_datetime:
        return ''
    try:
        from utils.timezone_helper import convert_utc_to_user_timezone
        return convert_utc_to_user_timezone(utc_datetime).strftime('%H:%M:%S')
    except:
        return utc_datetime.strftime('%H:%M:%S') if utc_datetime else ''

@app.template_filter('user_date')
def user_date_filter(utc_datetime):
    if not utc_datetime:
        return ''
    try:
        from utils.timezone_helper import convert_utc_to_user_timezone
        return convert_utc_to_user_timezone(utc_datetime).strftime('%Y-%m-%d')
    except:
        return utc_datetime.strftime('%Y-%m-%d') if utc_datetime else ''

# Register blueprint
from routes import main_bp
app.register_blueprint(main_bp)