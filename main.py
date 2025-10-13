from app import app
from models import db
from models import User, Department
from werkzeug.security import generate_password_hash

# Initialize database on startup
with app.app_context():
    # db.drop_all()
    db.create_all()
    
    # Create departments
    departments = [
        {'name': 'Engineering', 'description': 'Software development and technical teams'},
        {'name': 'Marketing', 'description': 'Marketing and communications team'},
        {'name': 'Sales', 'description': 'Sales and business development team'},
        {'name': 'Human Resources', 'description': 'HR and people operations team'},
        {'name': 'Operations', 'description': 'Operations and logistics team'}
    ]
    
    for d in departments:
        if not Department.query.filter_by(name=d['name']).first():
            db.session.add(Department(**d))
    
    db.session.commit()
    
    # Create admin
    if not User.query.filter_by(email='admin@teamcal.com').first():
        eng = Department.query.filter_by(name='Engineering').first()
        admin = User(
            username='admin',
            email='admin@teamcal.com',
            password_hash=generate_password_hash('admin123'),
            is_admin=True,
            approval_status='approved',
            department_id=eng.id if eng else None
        )
        db.session.add(admin)
        db.session.commit()
        print("✓ Admin created")

if __name__ == '__main__':
    print("🚀 Team Calendar: http://127.0.0.1:5000")
    app.run(debug=True, host='127.0.0.1', port=5000)