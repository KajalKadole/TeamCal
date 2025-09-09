from flask import render_template, flash, redirect, url_for, request, jsonify
from flask_login import login_user, logout_user, current_user, login_required
from werkzeug.security import generate_password_hash, check_password_hash
from app import app, db
from models import User, Department, AvailabilitySlot, BusySlot, LeaveDay, TimesheetEntry, UserStatus, BreakEntry
from forms import LoginForm, RegistrationForm, AvailabilityForm, BusySlotForm, LeaveDayForm, ProfileForm, AddEmployeeForm, DepartmentForm
from datetime import datetime, date, time
import json
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from utils.timezone_helper import (
    convert_utc_to_user_timezone, 
    convert_user_timezone_to_utc, 
    get_current_time_in_user_timezone,
    format_datetime_for_user,
    get_user_timezone
)

@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('calendar'))
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('calendar'))
    
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user and check_password_hash(user.password_hash, form.password.data):
            # Check approval status
            if user.approval_status == 'pending':
                flash('Your account is pending admin approval. Please wait for approval before logging in.', 'warning')
                return render_template('login.html', form=form)
            elif user.approval_status == 'rejected':
                flash('Your account has been rejected. Please contact an administrator.', 'danger')
                return render_template('login.html', form=form)
            elif user.approval_status == 'approved':
                login_user(user)
                next_page = request.args.get('next')
                flash(f'Welcome back, {user.username}!', 'success')
                return redirect(next_page) if next_page else redirect(url_for('calendar'))
        flash('Invalid email or password.', 'danger')
    
    return render_template('login.html', form=form)

@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('calendar'))
    
    form = RegistrationForm()
    if form.validate_on_submit():
        user = User(
            username=form.username.data,
            email=form.email.data,
            department_id=form.department_id.data if form.department_id.data != 0 else None,
            password_hash=generate_password_hash(form.password.data),
            approval_status='pending'  # New users need approval
        )
        db.session.add(user)
        db.session.commit()
        flash('Registration successful! Your account is pending admin approval. You will be able to log in once approved.', 'info')
        return redirect(url_for('login'))
    
    return render_template('register.html', form=form)

# Department management routes
@app.route('/admin/departments')
@login_required
def admin_departments():
    """Admin page to manage departments"""
    if not current_user.is_admin:
        flash('Access denied. Admin privileges required.', 'danger')
        return redirect(url_for('calendar'))
    
    departments = Department.query.order_by(Department.name).all()
    return render_template('admin/departments.html', departments=departments)

@app.route('/admin/departments/add', methods=['GET', 'POST'])
@login_required
def add_department():
    """Add a new department"""
    if not current_user.is_admin:
        flash('Access denied. Admin privileges required.', 'danger')
        return redirect(url_for('calendar'))
    
    form = DepartmentForm()
    if form.validate_on_submit():
        department = Department(
            name=form.name.data,
            description=form.description.data
        )
        db.session.add(department)
        db.session.commit()
        flash(f'Department "{department.name}" created successfully!', 'success')
        return redirect(url_for('admin_departments'))
    
    return render_template('admin/add_department.html', form=form)

@app.route('/admin/departments/<int:dept_id>/edit', methods=['GET', 'POST'])
@login_required
def edit_department(dept_id):
    """Edit a department"""
    if not current_user.is_admin:
        flash('Access denied. Admin privileges required.', 'danger')
        return redirect(url_for('calendar'))
    
    department = Department.query.get_or_404(dept_id)
    form = DepartmentForm(obj=department)
    
    if form.validate_on_submit():
        # Check if name changed and if new name already exists
        if form.name.data != department.name:
            existing_dept = Department.query.filter_by(name=form.name.data).first()
            if existing_dept:
                flash('A department with this name already exists.', 'danger')
                return render_template('admin/edit_department.html', form=form, department=department)
        
        department.name = form.name.data
        department.description = form.description.data
        db.session.commit()
        flash(f'Department "{department.name}" updated successfully!', 'success')
        return redirect(url_for('admin_departments'))
    
    return render_template('admin/edit_department.html', form=form, department=department)

@app.route('/admin/departments/<int:dept_id>/employees')
@login_required
def get_department_employees(dept_id):
    """Get available and assigned employees for a department"""
    if not current_user.is_admin:
        return jsonify({'error': 'Access denied'}), 403
    
    department = Department.query.get_or_404(dept_id)
    
    # Get all approved users
    all_users = User.query.filter_by(approval_status='approved').all()
    
    assigned = []
    available = []
    
    for user in all_users:
        if user.department_id == dept_id:
            assigned.append({
                'id': user.id,
                'username': user.username,
                'email': user.email
            })
        else:
            available.append({
                'id': user.id,
                'username': user.username,
                'email': user.email
            })
    
    return jsonify({
        'assigned': assigned,
        'available': available
    })

@app.route('/admin/departments/<int:dept_id>/assign/<int:user_id>', methods=['POST'])
@login_required
def assign_employee_to_department(dept_id, user_id):
    """Assign an employee to a department"""
    if not current_user.is_admin:
        return jsonify({'error': 'Access denied'}), 403
    
    department = Department.query.get_or_404(dept_id)
    user = User.query.get_or_404(user_id)
    
    user.department_id = dept_id
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': f'{user.username} assigned to {department.name}'
    })

@app.route('/admin/departments/<int:dept_id>/unassign/<int:user_id>', methods=['POST'])
@login_required
def unassign_employee_from_department(dept_id, user_id):
    """Unassign an employee from a department"""
    if not current_user.is_admin:
        return jsonify({'error': 'Access denied'}), 403
    
    user = User.query.get_or_404(user_id)
    
    user.department_id = None
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': f'{user.username} unassigned from department'
    })

@app.route('/admin/departments/<int:dept_id>/delete', methods=['POST'])
@login_required
def delete_department(dept_id):
    """Delete a department"""
    if not current_user.is_admin:
        return jsonify({'success': False, 'error': 'Access denied'}), 403
    
    department = Department.query.get_or_404(dept_id)
    
    # Check if department has users
    user_count = User.query.filter_by(department_id=dept_id).count()
    if user_count > 0:
        return jsonify({
            'success': False, 
            'error': f'Cannot delete department "{department.name}" - it has {user_count} users assigned'
        }), 400
    
    db.session.delete(department)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': f'Department "{department.name}" deleted successfully'
    })

# Admin routes for user approval management
@app.route('/admin/users')
@login_required
def admin_users():
    """Admin page to manage user approvals"""
    if not current_user.is_admin:
        flash('Access denied. Admin privileges required.', 'danger')
        return redirect(url_for('calendar'))
    
    # Get all users with their approval status
    users = User.query.order_by(User.created_at.desc()).all()
    return render_template('admin/users.html', users=users)

@app.route('/admin/users/<int:user_id>/approve', methods=['POST'])
@login_required
def approve_user(user_id):
    """Approve a pending user"""
    if not current_user.is_admin:
        return jsonify({'success': False, 'error': 'Access denied'}), 403
    
    user = User.query.get_or_404(user_id)
    if user.approval_status != 'pending':
        return jsonify({'success': False, 'error': 'User is not pending approval'}), 400
    
    user.approval_status = 'approved'
    user.approved_by = current_user.id
    user.approved_at = datetime.now()
    db.session.commit()
    
    return jsonify({
        'success': True, 
        'message': f'User {user.username} has been approved'
    })

@app.route('/admin/users/<int:user_id>/reject', methods=['POST'])
@login_required 
def reject_user(user_id):
    """Reject a pending user"""
    if not current_user.is_admin:
        return jsonify({'success': False, 'error': 'Access denied'}), 403
    
    user = User.query.get_or_404(user_id)
    if user.approval_status != 'pending':
        return jsonify({'success': False, 'error': 'User is not pending approval'}), 400
    
    user.approval_status = 'rejected' 
    user.approved_by = current_user.id
    user.approved_at = datetime.now()
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': f'User {user.username} has been rejected'
    })

@app.route('/api/admin/pending-users-count')
@login_required
def pending_users_count():
    """Get count of pending users for admin notification"""
    if not current_user.is_admin:
        return jsonify({'success': False, 'error': 'Access denied'}), 403
    
    count = User.query.filter_by(approval_status='pending').count()
    return jsonify({'success': True, 'count': count})

@app.route('/admin/users/<int:user_id>/department', methods=['POST'])
@login_required
def update_user_department(user_id):
    """Update a user's department assignment"""
    if not current_user.is_admin:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    user = User.query.get_or_404(user_id)
    
    department_id = data.get('department_id')
    if department_id:
        # Verify department exists
        department = Department.query.get(department_id)
        if not department:
            return jsonify({'error': 'Department not found'}), 404
        user.department_id = department_id
        message = f'{user.username} assigned to {department.name}'
    else:
        user.department_id = None
        message = f'{user.username} removed from department'
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': message
    })

@app.route('/api/departments')
@login_required
def get_departments_api():
    """Get all departments for API use"""
    if not current_user.is_admin:
        return jsonify({'error': 'Access denied'}), 403
    
    departments = Department.query.order_by(Department.name).all()
    return jsonify({
        'departments': [{'id': d.id, 'name': d.name, 'description': d.description} for d in departments]
    })

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out.', 'info')
    return redirect(url_for('index'))

@app.route('/calendar')
@login_required
def calendar():
    users = User.query.all() if current_user.is_admin else [current_user]
    departments = Department.query.order_by(Department.name).all() if current_user.is_admin else []
    return render_template('calendar.html', users=users, departments=departments)

@app.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    form = ProfileForm()
    
    if form.validate_on_submit():
        current_user.username = form.username.data
        current_user.email = form.email.data
        current_user.department_id = form.department_id.data
        if form.default_start_time.data:
            current_user.default_start_time = form.default_start_time.data.strftime('%H:%M')
        if form.default_end_time.data:
            current_user.default_end_time = form.default_end_time.data.strftime('%H:%M')
        current_user.timezone = form.timezone.data
        
        db.session.commit()
        flash('Profile updated successfully!', 'success')
        return redirect(url_for('profile'))
    
    # Pre-populate form with current user data
    if request.method == 'GET':
        form.username.data = current_user.username
        form.email.data = current_user.email
        form.department_id.data = current_user.department_id
        if current_user.default_start_time:
            form.default_start_time.data = datetime.strptime(current_user.default_start_time, '%H:%M').time()
        if current_user.default_end_time:
            form.default_end_time.data = datetime.strptime(current_user.default_end_time, '%H:%M').time()
        form.timezone.data = current_user.timezone or 'UTC'
    
    return render_template('profile.html', form=form)

@app.route('/admin')
@login_required
def admin():
    if not current_user.is_admin:
        flash('Access denied. Admin privileges required.', 'danger')
        return redirect(url_for('calendar'))
    
    form = AddEmployeeForm()
    users = User.query.all()
    return render_template('admin.html', form=form, users=users)

@app.route('/admin/add_employee', methods=['POST'])
@login_required
def add_employee():
    if not current_user.is_admin:
        return jsonify({'error': 'Access denied'}), 403
    
    form = AddEmployeeForm()
    if form.validate_on_submit():
        user = User(
            username=form.username.data,
            email=form.email.data,
            department_id=form.department_id.data,
            password_hash=generate_password_hash(form.password.data),
            approval_status='approved'  # Admin-added users are auto-approved
        )
        db.session.add(user)
        db.session.commit()
        flash(f'Employee {user.username} added successfully!', 'success')
    else:
        for field, errors in form.errors.items():
            for error in errors:
                flash(f'{field}: {error}', 'danger')
    
    return redirect(url_for('admin'))

# API Endpoints for Calendar Data
def generate_user_color(user_id, username):
    """Generate a unique color for each user based on their ID and username"""
    # Color palette for users - distinct, professional colors
    colors = [
        '#3498db',  # Blue
        '#e74c3c',  # Red
        '#2ecc71',  # Green
        '#f39c12',  # Orange
        '#9b59b6',  # Purple
        '#1abc9c',  # Turquoise
        '#e67e22',  # Carrot
        '#34495e',  # Dark blue-gray
        '#16a085',  # Dark turquoise
        '#27ae60',  # Dark green
        '#d35400',  # Dark orange
        '#8e44ad',  # Dark purple
        '#2980b9',  # Dark blue
        '#c0392b',  # Dark red
        '#7f8c8d',  # Gray
        '#95a5a6',  # Light gray
        '#f1c40f',  # Yellow
        '#e91e63',  # Pink
        '#ff5722',  # Deep orange
        '#607d8b'   # Blue gray
    ]
    
    # Use user_id to determine color, cycling through the palette
    color_index = (user_id - 1) % len(colors)
    return colors[color_index]

@app.route('/api/events')
@login_required
def get_events():
    start_date = request.args.get('start')
    end_date = request.args.get('end')
    user_filter = request.args.get('user_id')
    department_filter = request.args.get('department_id')
    filter_type = request.args.get('filter_type', 'all')  # 'individual', 'department', 'all'
    
    events = []
    
    # All users can now see team events - determine which users to show based on filter type
    if filter_type == 'individual' and user_filter:
        if user_filter == 'all':
            users = User.query.all()
        else:
            users = [User.query.get(int(user_filter))]
    elif filter_type == 'department' and department_filter:
        if department_filter == 'all':
            users = User.query.all()
        else:
            users = User.query.filter_by(department_id=int(department_filter)).all()
    elif filter_type == 'all':
        users = User.query.all()
    else:
        users = User.query.all()
    
    for user in users:
        # Generate unique color for this user
        user_color = generate_user_color(user.id, user.username)
        
        # Availability slots
        availability_slots = AvailabilitySlot.query.filter_by(user_id=user.id).all()
        for slot in availability_slots:
            events.append({
                'id': f'avail-{slot.id}',
                'title': f'{user.username} - Available',
                'start': f'{slot.date}T{slot.start_time}',
                'end': f'{slot.date}T{slot.end_time}',
                'color': user_color,
                'borderColor': user_color,
                'backgroundColor': user_color + '20',  # 20% opacity background
                'user_id': user.id,
                'username': user.username,
                'type': 'availability',
                'display': 'block'  # For Gantt-like appearance
            })
        
        # Busy slots - darker version of user color
        busy_slots = BusySlot.query.filter_by(user_id=user.id).all()
        for slot in busy_slots:
            # Create darker version for busy slots
            busy_color = user_color.replace('#', '#') + 'DD'  # Darker opacity
            events.append({
                'id': f'busy-{slot.id}',
                'title': f'{user.username} - {slot.title}',
                'start': f'{slot.date}T{slot.start_time}',
                'end': f'{slot.date}T{slot.end_time}',
                'color': user_color,
                'borderColor': user_color,
                'backgroundColor': user_color + '80',  # 80% opacity for busy
                'user_id': user.id,
                'username': user.username,
                'type': 'busy',
                'description': slot.description,
                'display': 'block'  # For Gantt-like appearance
            })
        
        # Leave days - user color with pattern
        leave_days = LeaveDay.query.filter_by(user_id=user.id).all()
        for leave in leave_days:
            events.append({
                'id': f'leave-{leave.id}',
                'title': f'{user.username} - {leave.leave_type}',
                'start': f'{leave.date}',
                'allDay': True,
                'color': user_color,
                'borderColor': user_color,
                'backgroundColor': user_color + '40',  # 40% opacity for leave
                'user_id': user.id,
                'username': user.username,
                'type': 'leave',
                'notes': leave.notes,
                'display': 'block'  # For Gantt-like appearance
            })
    
    return jsonify(events)

@app.route('/api/gantt-data')
@login_required
def get_gantt_data():
    user_filter = request.args.get('user_id')
    department_filter = request.args.get('department_id')
    filter_type = request.args.get('filter_type', 'all')
    
    # All users can now see team timeline data - determine which users to show based on filter type
    if filter_type == 'individual' and user_filter:
        if user_filter == 'all':
            users = User.query.all()
        else:
            users = [User.query.get(int(user_filter))]
    elif filter_type == 'department' and department_filter:
        if department_filter == 'all':
            users = User.query.all()
        else:
            users = User.query.filter_by(department_id=int(department_filter)).all()
    elif filter_type == 'all':
        users = User.query.all()
    else:
        users = User.query.all()
    
    gantt_data = {'users': []}
    
    for user in users:
        user_color = generate_user_color(user.id, user.username)
        user_events = []
        
        # Get all events for this user
        availability_slots = AvailabilitySlot.query.filter_by(user_id=user.id).all()
        for slot in availability_slots:
            user_events.append({
                'id': f'avail-{slot.id}',
                'title': f'{user.username} - Available',
                'start': f'{slot.date}T{slot.start_time}',
                'end': f'{slot.date}T{slot.end_time}',
                'type': 'availability'
            })
        
        busy_slots = BusySlot.query.filter_by(user_id=user.id).all()
        for slot in busy_slots:
            user_events.append({
                'id': f'busy-{slot.id}',
                'title': f'{user.username} - {slot.title}',
                'start': f'{slot.date}T{slot.start_time}',
                'end': f'{slot.date}T{slot.end_time}',
                'type': 'busy'
            })
        
        leave_days = LeaveDay.query.filter_by(user_id=user.id).all()
        for leave in leave_days:
            user_events.append({
                'id': f'leave-{leave.id}',
                'title': f'{user.username} - {leave.leave_type}',
                'start': f'{leave.date}',
                'end': f'{leave.date}',
                'type': 'leave'
            })
        
        # Only include users who have events (availability, busy, or leave)
        if user_events:
            gantt_data['users'].append({
                'id': user.id,
                'username': user.username,
                'color': user_color,
                'events': user_events
            })
    
    return jsonify(gantt_data)

@app.route('/api/availability', methods=['POST'])
@login_required
def add_availability():
    data = request.get_json()
    
    try:
        slot = AvailabilitySlot(
            user_id=current_user.id,
            date=datetime.strptime(data['date'], '%Y-%m-%d').date(),
            start_time=datetime.strptime(data['start_time'], '%H:%M').time(),
            end_time=datetime.strptime(data['end_time'], '%H:%M').time(),
            recurring=data.get('recurring', False)
        )
        
        db.session.add(slot)
        db.session.commit()
        
        return jsonify({'success': True, 'id': slot.id})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/multi-availability', methods=['POST'])
@login_required
def add_multi_availability():
    data = request.get_json()
    
    try:
        dates = data.get('dates', [])
        start_time_str = data.get('start_time')
        end_time_str = data.get('end_time')
        
        if not dates or not start_time_str or not end_time_str:
            return jsonify({'success': False, 'error': 'Missing required fields'}), 400
        
        # Parse times
        start_time = datetime.strptime(start_time_str, '%H:%M').time()
        end_time = datetime.strptime(end_time_str, '%H:%M').time()
        
        # Validate time range
        if start_time >= end_time:
            return jsonify({'success': False, 'error': 'End time must be after start time'}), 400
        
        # Create availability slots for all dates
        slots_created = 0
        errors = []
        
        for date_str in dates:
            try:
                # Check if availability already exists for this date and time
                date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
                existing = AvailabilitySlot.query.filter_by(
                    user_id=current_user.id,
                    date=date_obj,
                    start_time=start_time,
                    end_time=end_time
                ).first()
                
                if not existing:
                    slot = AvailabilitySlot(
                        user_id=current_user.id,
                        date=date_obj,
                        start_time=start_time,
                        end_time=end_time,
                        recurring=False
                    )
                    db.session.add(slot)
                    slots_created += 1
                else:
                    errors.append(f"Availability already exists for {date_str}")
                    
            except Exception as e:
                errors.append(f"Error creating slot for {date_str}: {str(e)}")
        
        # Commit all changes
        if slots_created > 0:
            db.session.commit()
        
        # Prepare response
        response_data = {
            'success': True, 
            'slots_created': slots_created,
            'total_dates': len(dates)
        }
        
        if errors:
            response_data['warnings'] = errors
        
        return jsonify(response_data)
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/busy', methods=['POST'])
@login_required
def add_busy_slot():
    data = request.get_json()
    
    try:
        slot = BusySlot(
            user_id=current_user.id,
            date=datetime.strptime(data['date'], '%Y-%m-%d').date(),
            start_time=datetime.strptime(data['start_time'], '%H:%M').time(),
            end_time=datetime.strptime(data['end_time'], '%H:%M').time(),
            title=data.get('title', 'Busy'),
            description=data.get('description', '')
        )
        
        db.session.add(slot)
        db.session.commit()
        
        return jsonify({'success': True, 'id': slot.id})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/leave', methods=['POST'])
@login_required
def add_leave_day():
    data = request.get_json()
    
    try:
        leave = LeaveDay(
            user_id=current_user.id,
            date=datetime.strptime(data['date'], '%Y-%m-%d').date(),
            leave_type=data.get('leave_type', 'Leave'),
            notes=data.get('notes', '')
        )
        
        db.session.add(leave)
        db.session.commit()
        
        return jsonify({'success': True, 'id': leave.id})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/events/<event_type>/<int:event_id>', methods=['PUT'])
@login_required
def update_event(event_type, event_id):
    try:
        data = request.get_json()
        
        if event_type == 'availability':
            event = AvailabilitySlot.query.get_or_404(event_id)
        elif event_type == 'busy':
            event = BusySlot.query.get_or_404(event_id)
        elif event_type == 'leave':
            event = LeaveDay.query.get_or_404(event_id)
        else:
            return jsonify({'success': False, 'error': 'Invalid event type'}), 400
        
        # Check if user owns the event or is admin
        if event.user_id != current_user.id and not current_user.is_admin:
            return jsonify({'success': False, 'error': 'Access denied'}), 403
        
        # Update common fields
        event.date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        
        # Update type-specific fields
        if event_type == 'availability':
            event.start_time = datetime.strptime(data['start_time'], '%H:%M').time()
            event.end_time = datetime.strptime(data['end_time'], '%H:%M').time()
        elif event_type == 'busy':
            event.start_time = datetime.strptime(data['start_time'], '%H:%M').time()
            event.end_time = datetime.strptime(data['end_time'], '%H:%M').time()
            event.title = data.get('title', 'Busy')
            event.description = data.get('description', '')
        elif event_type == 'leave':
            event.leave_type = data.get('leave_type', 'Leave')
            event.notes = data.get('notes', '')
        
        db.session.commit()
        return jsonify({'success': True, 'id': event.id})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/events/<event_type>/<int:event_id>', methods=['DELETE'])
@login_required
def delete_event(event_type, event_id):
    try:
        if event_type == 'availability':
            event = AvailabilitySlot.query.get_or_404(event_id)
        elif event_type == 'busy':
            event = BusySlot.query.get_or_404(event_id)
        elif event_type == 'leave':
            event = LeaveDay.query.get_or_404(event_id)
        else:
            return jsonify({'success': False, 'error': 'Invalid event type'}), 400
        
        # Check if user owns the event or is admin
        if event.user_id != current_user.id and not current_user.is_admin:
            return jsonify({'success': False, 'error': 'Access denied'}), 403
        
        db.session.delete(event)
        db.session.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

# Timesheet Routes
@app.route('/timesheet')
@login_required
def timesheet():
    """Timesheet view for logging work hours"""
    return render_template('timesheet.html')

@app.route('/api/timesheet/clock-in', methods=['POST'])
@login_required
def clock_in():
    """Clock in user and start timesheet entry"""
    try:
        data = request.get_json() or {}
        
        # Check if user is already clocked in
        active_entry = TimesheetEntry.query.filter_by(
            user_id=current_user.id,
            clock_out=None
        ).first()
        
        if active_entry:
            return jsonify({'success': False, 'error': 'Already clocked in'}), 400
        
        # Create new timesheet entry - times stored in UTC
        utc_now = datetime.utcnow()
        entry = TimesheetEntry(
            user_id=current_user.id,
            date=utc_now.date(),
            clock_in=utc_now,
            location=data.get('location', 'Office'),
            notes=data.get('notes', '')
        )
        
        db.session.add(entry)
        db.session.flush()  # Ensure entry.id is available
        
        # Update user status
        user_status = UserStatus.query.filter_by(user_id=current_user.id).first()
        if not user_status:
            user_status = UserStatus(user_id=current_user.id)
            db.session.add(user_status)
        
        user_status.is_working = True
        user_status.current_timesheet_id = entry.id
        user_status.status_message = 'Available'
        user_status.current_task = data.get('task', '')
        user_status.last_activity = datetime.utcnow()
        
        db.session.commit()
        
        # Convert UTC times to user's timezone for display
        user_clock_in = convert_utc_to_user_timezone(entry.clock_in)
        
        return jsonify({
            'success': True,
            'entry_id': entry.id,
            'clock_in': user_clock_in.isoformat(),
            'status': 'clocked_in'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/timesheet/clock-out', methods=['POST'])
@login_required
def clock_out():
    """Clock out user and complete timesheet entry"""
    try:
        data = request.get_json() or {}
        
        # Find active timesheet entry
        entry = TimesheetEntry.query.filter_by(
            user_id=current_user.id,
            clock_out=None
        ).first()
        
        if not entry:
            return jsonify({'success': False, 'error': 'Not clocked in'}), 400
        
        # End any active breaks first
        active_breaks = BreakEntry.query.filter_by(
            user_id=current_user.id,
            timesheet_entry_id=entry.id,
            break_end=None
        ).all()
        
        clock_out_time = datetime.utcnow()
        for break_entry in active_breaks:
            break_entry.break_end = clock_out_time
        
        # Calculate total break duration from BreakEntry records
        total_break_duration = db.session.query(
            db.func.sum(
                db.func.extract('epoch', BreakEntry.break_end - BreakEntry.break_start) / 60
            )
        ).filter(
            BreakEntry.timesheet_entry_id == entry.id,
            BreakEntry.break_end.isnot(None)
        ).scalar() or 0
        
        # Update timesheet entry
        entry.clock_out = clock_out_time
        entry.break_duration = int(total_break_duration)  # Server-authoritative break duration
        if data.get('notes'):
            entry.notes = data.get('notes')
        
        # Update user status
        user_status = UserStatus.query.filter_by(user_id=current_user.id).first()
        if user_status:
            user_status.is_working = False
            user_status.current_timesheet_id = None
            user_status.status_message = 'Offline'
            user_status.current_task = ''
            user_status.last_activity = datetime.utcnow()
        
        db.session.commit()
        
        # Convert UTC times to user's timezone for display
        user_clock_out = convert_utc_to_user_timezone(entry.clock_out)
        
        return jsonify({
            'success': True,
            'entry_id': entry.id,
            'clock_out': user_clock_out.isoformat(),
            'duration': entry.duration,
            'status': 'clocked_out'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/timesheet/start-break', methods=['POST'])
@login_required
def start_break():
    """Start a break for the current user"""
    try:
        # Check if user is currently clocked in
        active_entry = TimesheetEntry.query.filter_by(
            user_id=current_user.id,
            clock_out=None
        ).first()
        
        if not active_entry:
            return jsonify({'success': False, 'error': 'You must be clocked in to start a break'}), 400
        
        # Check if there's already an active break
        active_break = BreakEntry.query.filter_by(
            user_id=current_user.id,
            timesheet_entry_id=active_entry.id,
            break_end=None
        ).first()
        
        if active_break:
            return jsonify({'success': False, 'error': 'Break is already in progress'}), 400
        
        # Create new break entry - times stored in UTC
        break_entry = BreakEntry(
            user_id=current_user.id,
            timesheet_entry_id=active_entry.id,
            break_start=datetime.utcnow(),
            break_type=request.json.get('break_type', 'Break')
        )
        
        db.session.add(break_entry)
        
        # Update user status to "On Break"
        user_status = UserStatus.query.filter_by(user_id=current_user.id).first()
        if user_status:
            user_status.status_message = 'On Break'
            user_status.current_task = f"On {break_entry.break_type}"
            user_status.updated_at = datetime.now()
        
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'message': 'Break started successfully. Change your status from "On Break" to end the break.',
            'break_id': break_entry.id
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/timesheet/end-break', methods=['POST'])
@login_required
def end_break():
    """End the current break for the current user"""
    try:
        # Find active break
        active_break = BreakEntry.query.filter_by(
            user_id=current_user.id,
            break_end=None
        ).first()
        
        if not active_break:
            return jsonify({'success': False, 'error': 'No active break found'}), 400
        
        # End the break
        active_break.break_end = datetime.now()
        
        # Update the timesheet entry's break duration
        timesheet_entry = active_break.timesheet_entry
        total_break_duration = db.session.query(
            db.func.sum(
                db.func.extract('epoch', BreakEntry.break_end - BreakEntry.break_start) / 60
            )
        ).filter(
            BreakEntry.timesheet_entry_id == timesheet_entry.id,
            BreakEntry.break_end.isnot(None)
        ).scalar() or 0
        
        timesheet_entry.break_duration = int(total_break_duration) + active_break.duration
        
        # Update user status back to Available
        user_status = UserStatus.query.filter_by(user_id=current_user.id).first()
        if user_status:
            user_status.status_message = 'Available'
            user_status.current_task = request.json.get('task', '')
            user_status.updated_at = datetime.now()
        
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'message': 'Break ended successfully',
            'break_duration': active_break.duration
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/timesheet/status', methods=['GET'])
@login_required
def get_timesheet_status():
    """Get current timesheet status for user"""
    try:
        # Check for auto-checkout first
        check_and_perform_auto_checkout(current_user.id)
        
        # Check for active entry
        active_entry = TimesheetEntry.query.filter_by(
            user_id=current_user.id,
            clock_out=None
        ).first()
        
        user_status = UserStatus.query.filter_by(user_id=current_user.id).first()
        
        if active_entry:
            return jsonify({
                'success': True,
                'is_clocked_in': True,
                'entry_id': active_entry.id,
                'clock_in': active_entry.clock_in.isoformat(),
                'current_duration': (datetime.utcnow() - active_entry.clock_in).total_seconds() / 60,
                'location': active_entry.location,
                'current_task': user_status.current_task if user_status else '',
                'status_message': user_status.status_message if user_status else 'Available'
            })
        else:
            return jsonify({
                'success': True,
                'is_clocked_in': False,
                'current_duration': 0,
                'status_message': user_status.status_message if user_status else 'Offline'
            })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

def check_and_perform_auto_checkout(user_id):
    """Check if a user should be automatically clocked out after 6 hours"""
    try:
        # Find active timesheet entry
        active_entry = TimesheetEntry.query.filter_by(
            user_id=user_id,
            clock_out=None
        ).first()
        
        if not active_entry:
            return False
        
        # Calculate hours worked
        utc_now = datetime.utcnow()
        hours_worked = (utc_now - active_entry.clock_in).total_seconds() / 3600
        
        # Auto-checkout after 6 hours
        if hours_worked >= 6:
            # Perform automatic checkout
            active_entry.clock_out = utc_now
            # Note: duration is calculated automatically via @property, don't set it directly
            existing_notes = active_entry.notes or ''
            active_entry.notes = existing_notes + ' [Auto-checkout after 6 hours]' if existing_notes else '[Auto-checkout after 6 hours]'
            
            # Update user status
            user_status = UserStatus.query.filter_by(user_id=user_id).first()
            if user_status:
                user_status.is_working = False
                user_status.current_timesheet_id = None
                user_status.status_message = 'Offline'
                user_status.last_activity = utc_now
            
            db.session.commit()
            return True
            
        return False
        
    except Exception as e:
        print(f"Error in auto-checkout for user {user_id}: {str(e)}")
        return False

@app.route('/api/timesheet/update-status', methods=['POST'])
@login_required
def update_user_status():
    """Update user's current status and task"""
    try:
        data = request.get_json()
        
        user_status = UserStatus.query.filter_by(user_id=current_user.id).first()
        if not user_status:
            user_status = UserStatus(user_id=current_user.id)
            db.session.add(user_status)
        
        # Check if user is changing away from "On Break" status
        break_ended = False
        if (user_status.status_message == 'On Break' and 
            'status_message' in data and 
            data['status_message'] != 'On Break'):
            
            # Find active timesheet entry first
            active_timesheet = TimesheetEntry.query.filter_by(
                user_id=current_user.id,
                clock_out=None
            ).first()
            
            if active_timesheet:
                # End any active breaks for this timesheet entry
                active_breaks = BreakEntry.query.filter_by(
                    user_id=current_user.id,
                    timesheet_entry_id=active_timesheet.id,
                    break_end=None
                ).all()
                
                for break_entry in active_breaks:
                    break_entry.break_end = datetime.now()
                    break_ended = True
                
                if active_breaks:
                    # Recalculate total break duration for the timesheet entry
                    total_break_duration = db.session.query(
                        db.func.sum(
                            db.func.extract('epoch', BreakEntry.break_end - BreakEntry.break_start) / 60
                        )
                    ).filter(
                        BreakEntry.timesheet_entry_id == active_timesheet.id,
                        BreakEntry.break_end.isnot(None)
                    ).scalar() or 0
                    
                    active_timesheet.break_duration = int(total_break_duration)
        
        if 'status_message' in data:
            user_status.status_message = data['status_message']
        if 'current_task' in data:
            user_status.current_task = data['current_task']
        
        user_status.last_activity = datetime.utcnow()
        
        db.session.commit()
        
        message = 'Break ended and status updated successfully' if break_ended else 'Status updated successfully'
        return jsonify({
            'success': True, 
            'message': message,
            'break_ended': break_ended
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/team/status', methods=['GET'])
@login_required
def get_team_status():
    """Get current status of all team members"""
    try:
        if not current_user.is_admin:
            return jsonify({'success': False, 'error': 'Access denied'}), 403
        
        # Get all users with their status and active timesheets in bulk
        users_query = db.session.query(User, UserStatus).outerjoin(UserStatus).all()
        
        # Check for auto-checkout for all users before fetching status
        user_ids = [user.id for user, _ in users_query]
        for user_id in user_ids:
            check_and_perform_auto_checkout(user_id)
        
        # Bulk fetch active timesheet entries to avoid N+1 queries (after auto-checkout checks)
        active_entries = db.session.query(TimesheetEntry).filter(
            TimesheetEntry.user_id.in_(user_ids),
            TimesheetEntry.clock_out.is_(None)
        ).all()
        active_entries_by_user = {entry.user_id: entry for entry in active_entries}
        
        team_status = []
        for user, status in users_query:
            active_entry = active_entries_by_user.get(user.id)
            
            # Determine status message safely
            if active_entry:
                status_msg = (status.status_message if status else None) or 'Working'
            else:
                status_msg = (status.status_message if status else None) or 'Offline'
            
            team_status.append({
                'user_id': user.id,
                'username': user.username,
                'is_working': status.is_working if status else False,
                'is_clocked_in': active_entry is not None,
                'status_message': status_msg,
                'current_task': status.current_task if status else '',
                'last_activity': status.last_activity.isoformat() if status and status.last_activity else None,
                'clock_in_time': active_entry.clock_in.isoformat() if active_entry else None,
                'current_duration': (datetime.utcnow() - active_entry.clock_in).total_seconds() / 60 if active_entry else 0
            })
        
        return jsonify({'success': True, 'team_status': team_status})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/team/public-status', methods=['GET'])
@login_required
def get_public_team_status():
    """Get public team status (limited info for non-admin users)"""
    try:
        # Get all users with their status (limited info)
        users_query = db.session.query(User, UserStatus).outerjoin(UserStatus).all()
        
        # Bulk fetch active timesheet entries to avoid N+1 queries
        user_ids = [user.id for user, _ in users_query]
        active_entries = db.session.query(TimesheetEntry).filter(
            TimesheetEntry.user_id.in_(user_ids),
            TimesheetEntry.clock_out.is_(None)
        ).all()
        active_entries_by_user = {entry.user_id: entry for entry in active_entries}
        
        public_status = []
        for user, status in users_query:
            active_entry = active_entries_by_user.get(user.id)
            
            # Only show basic info for public status
            if status and status.is_working and active_entry:
                public_status.append({
                    'user_id': user.id,
                    'username': user.username,
                    'is_working': True,
                    'is_clocked_in': True,
                    'status_message': status.status_message or 'Working',
                    'current_task': status.current_task if status.current_task else '',
                    'current_duration': (datetime.utcnow() - active_entry.clock_in).total_seconds() / 60
                })
            elif active_entry:  # User is clocked in but no status record
                public_status.append({
                    'user_id': user.id,
                    'username': user.username,
                    'is_working': True,
                    'is_clocked_in': True,
                    'status_message': 'Working',
                    'current_task': '',
                    'current_duration': (datetime.utcnow() - active_entry.clock_in).total_seconds() / 60
                })
        
        return jsonify({'success': True, 'public_status': public_status})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/analytics')
@login_required
def analytics():
    """Admin analytics dashboard"""
    
    if not current_user.is_admin:
        flash('Access denied. Admin privileges required.', 'danger')
        return redirect(url_for('calendar'))
    
    # Get basic stats for the template
    total_users = User.query.count()
    total_entries = TimesheetEntry.query.count()
    
    # Get users for filter dropdown
    users = User.query.order_by(User.username).all()
    
    return render_template('analytics.html', 
                         total_users=total_users,
                         total_entries=total_entries,
                         users=users)

@app.route('/api/analytics/overview', methods=['GET'])
@login_required
def analytics_overview():
    """Get overview analytics data"""
    
    if not current_user.is_authenticated:
        return jsonify({'success': False, 'error': 'Authentication required'}), 401
    if not current_user.is_admin:
        return jsonify({'success': False, 'error': 'Admin access required'}), 403
    
    try:
        # Get time range filter
        days = int(request.args.get('days', 30))
        
        # Basic counts
        total_users = User.query.count()
        total_entries = TimesheetEntry.query.count()
        active_users = db.session.query(UserStatus).filter_by(is_working=True).count()
        
        # Date range for filtering
        from datetime import datetime, timedelta
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        # Total hours worked (within selected time range)
        total_hours_result = db.session.query(
            db.func.sum(
                db.func.extract('epoch', TimesheetEntry.clock_out - TimesheetEntry.clock_in) / 3600
            ).label('total_hours')
        ).filter(
            TimesheetEntry.clock_out.isnot(None),
            TimesheetEntry.clock_in >= start_date
        ).scalar()
        
        total_hours = float(total_hours_result) if total_hours_result else 0
        
        # This week's hours
        week_start = datetime.now() - timedelta(days=datetime.now().weekday())
        week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
        
        week_hours_result = db.session.query(
            db.func.sum(
                db.func.extract('epoch', TimesheetEntry.clock_out - TimesheetEntry.clock_in) / 3600
            ).label('week_hours')
        ).filter(
            TimesheetEntry.clock_out.isnot(None),
            TimesheetEntry.clock_in >= week_start
        ).scalar()
        
        week_hours = float(week_hours_result) if week_hours_result else 0
        
        return jsonify({
            'success': True,
            'data': {
                'total_users': total_users,
                'total_entries': total_entries,
                'active_users': active_users,
                'total_hours': round(total_hours, 1),
                'week_hours': round(week_hours, 1)
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/analytics/work-hours-trend', methods=['GET'])
@login_required
def analytics_work_hours_trend():
    """Get work hours trend data for charts"""
    if not current_user.is_authenticated:
        return jsonify({'success': False, 'error': 'Authentication required'}), 401
    if not current_user.is_admin:
        return jsonify({'success': False, 'error': 'Admin access required'}), 403
    
    try:
        # Get time range filter
        days = int(request.args.get('days', 30))
        
        # Get date range based on filter
        from datetime import datetime, timedelta
        end_date = datetime.now().replace(hour=23, minute=59, second=59)
        start_date = end_date - timedelta(days=days-1)
        start_date = start_date.replace(hour=0, minute=0, second=0)
        
        # Query daily hours
        daily_hours = db.session.query(
            db.func.date(TimesheetEntry.clock_in).label('work_date'),
            db.func.sum(
                db.func.extract('epoch', TimesheetEntry.clock_out - TimesheetEntry.clock_in) / 3600
            ).label('total_hours')
        ).filter(
            TimesheetEntry.clock_out.isnot(None),
            TimesheetEntry.clock_in >= start_date,
            TimesheetEntry.clock_in <= end_date
        ).group_by(db.func.date(TimesheetEntry.clock_in)).all()
        
        # Create complete date range with 0 hours for missing days
        date_range = []
        current_date = start_date.date()
        hours_dict = {row.work_date: float(row.total_hours) for row in daily_hours}
        
        for i in range(days):
            date_str = current_date.strftime('%Y-%m-%d')
            date_range.append({
                'date': date_str,
                'hours': round(hours_dict.get(current_date, 0), 1)
            })
            current_date += timedelta(days=1)
        
        return jsonify({'success': True, 'data': date_range})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/analytics/user-productivity', methods=['GET'])
@login_required 
def analytics_user_productivity():
    """Get user productivity metrics"""
    if not current_user.is_authenticated:
        return jsonify({'success': False, 'error': 'Authentication required'}), 401
    if not current_user.is_admin:
        return jsonify({'success': False, 'error': 'Admin access required'}), 403
    
    try:
        # Get time range filter
        days = int(request.args.get('days', 30))
        
        # Get productivity data per user (based on selected time range)
        from datetime import datetime, timedelta
        start_date = datetime.now() - timedelta(days=days)
        
        user_stats = db.session.query(
            User.username,
            db.func.count(TimesheetEntry.id).label('total_sessions'),
            db.func.sum(
                db.func.extract('epoch', TimesheetEntry.clock_out - TimesheetEntry.clock_in) / 3600
            ).label('total_hours'),
            db.func.avg(
                db.func.extract('epoch', TimesheetEntry.clock_out - TimesheetEntry.clock_in) / 3600
            ).label('avg_session_hours')
        ).join(TimesheetEntry).filter(
            TimesheetEntry.clock_out.isnot(None),
            TimesheetEntry.clock_in >= start_date
        ).group_by(User.id, User.username).all()
        
        productivity_data = []
        for stat in user_stats:
            productivity_data.append({
                'username': stat.username,
                'total_sessions': stat.total_sessions,
                'total_hours': round(float(stat.total_hours), 1),
                'avg_session_hours': round(float(stat.avg_session_hours), 2)
            })
        
        return jsonify({'success': True, 'data': productivity_data})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/analytics/status-distribution', methods=['GET'])
@login_required
def analytics_status_distribution():
    """Get current status distribution across team"""
    if not current_user.is_authenticated:
        return jsonify({'success': False, 'error': 'Authentication required'}), 401
    if not current_user.is_admin:
        return jsonify({'success': False, 'error': 'Admin access required'}), 403
    
    try:
        # Get current status distribution
        status_counts = db.session.query(
            UserStatus.status_message,
            db.func.count(UserStatus.id).label('count')
        ).join(User).filter(
            UserStatus.is_working == True
        ).group_by(UserStatus.status_message).all()
        
        # Get offline users
        total_users = User.query.count()
        online_users = db.session.query(UserStatus).filter_by(is_working=True).count()
        offline_users = total_users - online_users
        
        distribution_data = []
        for status in status_counts:
            status_name = status.status_message or 'Available'
            distribution_data.append({
                'status': status_name,
                'count': status.count
            })
        
        if offline_users > 0:
            distribution_data.append({
                'status': 'Offline',
                'count': offline_users
            })
        
        return jsonify({'success': True, 'data': distribution_data})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/timesheet/entries', methods=['GET'])
@login_required
def get_timesheet_entries():
    """Get timesheet entries for current user or all users (admin)"""
    try:
        user_id = request.args.get('user_id', type=int)
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Permission check
        if user_id and user_id != current_user.id and not current_user.is_admin:
            return jsonify({'success': False, 'error': 'Access denied'}), 403
        
        # Build query
        query = TimesheetEntry.query
        
        if user_id:
            query = query.filter_by(user_id=user_id)
        elif not current_user.is_admin:
            query = query.filter_by(user_id=current_user.id)
        
        if start_date:
            query = query.filter(TimesheetEntry.date >= datetime.strptime(start_date, '%Y-%m-%d').date())
        if end_date:
            query = query.filter(TimesheetEntry.date <= datetime.strptime(end_date, '%Y-%m-%d').date())
        
        entries = query.order_by(TimesheetEntry.date.desc(), TimesheetEntry.clock_in.desc()).all()
        
        entries_data = []
        for entry in entries:
            # Convert UTC times to user's timezone for display
            user_clock_in = convert_utc_to_user_timezone(entry.clock_in, current_user.timezone) if entry.clock_in else None
            user_clock_out = convert_utc_to_user_timezone(entry.clock_out, current_user.timezone) if entry.clock_out else None
            user_date = user_clock_in.date() if user_clock_in else entry.date
            
            entries_data.append({
                'id': entry.id,
                'user_id': entry.user_id,
                'username': entry.user.username,
                'date': user_date.isoformat(),
                'clock_in': user_clock_in.isoformat() if user_clock_in else None,
                'clock_out': user_clock_out.isoformat() if user_clock_out else None,
                'duration': entry.duration,
                'break_duration': entry.break_duration,
                'location': entry.location,
                'notes': entry.notes,
                'is_active': entry.is_active
            })
        
        return jsonify({'success': True, 'entries': entries_data})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/availability/analytics')
@login_required
def availability_analytics():
    """Get availability analytics data from calendar"""
    try:
        user_id = request.args.get('user_id')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Build query for availability slots
        query = AvailabilitySlot.query
        
        if user_id and current_user.is_admin:
            query = query.filter(AvailabilitySlot.user_id == user_id)
        elif not current_user.is_admin:
            query = query.filter(AvailabilitySlot.user_id == current_user.id)
        
        if start_date:
            query = query.filter(AvailabilitySlot.date >= datetime.strptime(start_date, '%Y-%m-%d').date())
        if end_date:
            query = query.filter(AvailabilitySlot.date <= datetime.strptime(end_date, '%Y-%m-%d').date())
        
        availability_slots = query.order_by(AvailabilitySlot.date.desc()).all()
        
        # Build query for busy slots
        busy_query = BusySlot.query
        if user_id and current_user.is_admin:
            busy_query = busy_query.filter(BusySlot.user_id == user_id)
        elif not current_user.is_admin:
            busy_query = busy_query.filter(BusySlot.user_id == current_user.id)
        
        if start_date:
            busy_query = busy_query.filter(BusySlot.date >= datetime.strptime(start_date, '%Y-%m-%d').date())
        if end_date:
            busy_query = busy_query.filter(BusySlot.date <= datetime.strptime(end_date, '%Y-%m-%d').date())
        
        busy_slots = busy_query.order_by(BusySlot.date.desc()).all()
        
        # Build query for leave days
        leave_query = LeaveDay.query
        if user_id and current_user.is_admin:
            leave_query = leave_query.filter(LeaveDay.user_id == user_id)
        elif not current_user.is_admin:
            leave_query = leave_query.filter(LeaveDay.user_id == current_user.id)
        
        if start_date:
            leave_query = leave_query.filter(LeaveDay.date >= datetime.strptime(start_date, '%Y-%m-%d').date())
        if end_date:
            leave_query = leave_query.filter(LeaveDay.date <= datetime.strptime(end_date, '%Y-%m-%d').date())
        
        leave_days = leave_query.order_by(LeaveDay.date.desc()).all()
        
        # Format availability data
        availability_data = []
        for slot in availability_slots:
            # Note: start_time and end_time are time objects, not datetime, so no timezone conversion needed
            user_start_time = slot.start_time
            user_end_time = slot.end_time
            
            availability_data.append({
                'id': slot.id,
                'type': 'availability',
                'user_id': slot.user_id,
                'username': slot.user.username,
                'date': slot.date.isoformat(),
                'start_time': user_start_time.strftime('%H:%M') if user_start_time else None,
                'end_time': user_end_time.strftime('%H:%M') if user_end_time else None,
                'status': 'Available',
                'notes': ''  # AvailabilitySlot doesn't have a notes field
            })
        
        # Format busy data
        for slot in busy_slots:
            # Note: start_time and end_time are time objects, not datetime, so no timezone conversion needed
            user_start_time = slot.start_time
            user_end_time = slot.end_time
            
            availability_data.append({
                'id': slot.id,
                'type': 'busy',
                'user_id': slot.user_id,
                'username': slot.user.username,
                'date': slot.date.isoformat(),
                'start_time': user_start_time.strftime('%H:%M') if user_start_time else None,
                'end_time': user_end_time.strftime('%H:%M') if user_end_time else None,
                'status': 'Busy',
                'notes': slot.description or ''  # BusySlot uses description field instead of notes
            })
        
        # Format leave data
        for leave in leave_days:
            availability_data.append({
                'id': leave.id,
                'type': 'leave',
                'user_id': leave.user_id,
                'username': leave.user.username,
                'date': leave.date.isoformat(),
                'start_time': 'All Day',
                'end_time': 'All Day',
                'status': 'Leave',
                'notes': leave.notes or ''
            })
        
        # Sort by date
        availability_data.sort(key=lambda x: x['date'], reverse=True)
        
        # Calculate analytics
        def calculate_duration_hours(start_time, end_time):
            """Calculate duration in hours between two time objects"""
            if not start_time or not end_time:
                return 0
            # Convert time objects to datetime objects for the same day
            base_date = datetime.now().date()
            start_dt = datetime.combine(base_date, start_time)
            end_dt = datetime.combine(base_date, end_time)
            
            # Handle case where end time is next day (e.g., night shift)
            if end_dt < start_dt:
                end_dt += timedelta(days=1)
            
            return (end_dt - start_dt).total_seconds() / 3600
        
        total_availability_hours = sum([
            calculate_duration_hours(slot.start_time, slot.end_time)
            for slot in availability_slots 
        ])
        
        total_busy_hours = sum([
            calculate_duration_hours(slot.start_time, slot.end_time)
            for slot in busy_slots 
        ])
        
        total_leave_days = len(leave_days)
        
        # Get unique dates for availability rate calculation
        availability_dates = set([slot.date for slot in availability_slots])
        busy_dates = set([slot.date for slot in busy_slots])
        leave_dates = set([leave.date for leave in leave_days])
        all_dates = availability_dates.union(busy_dates).union(leave_dates)
        
        analytics = {
            'total_availability_hours': round(total_availability_hours, 1),
            'total_busy_hours': round(total_busy_hours, 1),
            'total_leave_days': total_leave_days,
            'total_scheduled_days': len(all_dates),
            'availability_rate': round((len(availability_dates) / len(all_dates) * 100) if all_dates else 0, 1)
        }
        
        return jsonify({
            'success': True, 
            'data': availability_data,
            'analytics': analytics
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/availability-analytics')
@login_required
def availability_analytics_page():
    """Availability analytics dashboard page"""
    return render_template('availability_analytics.html')

@app.route('/api/users')
@login_required
def get_users():
    """Get list of users (admin only)"""
    if not current_user.is_admin:
        return jsonify({'success': False, 'error': 'Access denied'}), 403
    
    try:
        users = User.query.filter_by(approval_status='approved').order_by(User.username).all()
        users_data = [{'id': user.id, 'username': user.username} for user in users]
        return jsonify({'success': True, 'users': users_data})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/timesheet/download', methods=['GET'])
@login_required
def download_timesheet():
    """Download timesheet entries as CSV"""
    try:
        user_id = request.args.get('user_id', type=int)
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Permission check
        if user_id and user_id != current_user.id and not current_user.is_admin:
            return jsonify({'success': False, 'error': 'Access denied'}), 403
        
        # Build query
        query = TimesheetEntry.query
        
        if user_id:
            query = query.filter_by(user_id=user_id)
        elif not current_user.is_admin:
            query = query.filter_by(user_id=current_user.id)
        
        if start_date:
            query = query.filter(TimesheetEntry.date >= datetime.strptime(start_date, '%Y-%m-%d').date())
        if end_date:
            query = query.filter(TimesheetEntry.date <= datetime.strptime(end_date, '%Y-%m-%d').date())
        
        entries = query.order_by(TimesheetEntry.date.desc(), TimesheetEntry.clock_in.desc()).all()
        
        # Generate CSV content
        import csv
        from io import StringIO
        
        output = StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            'Date (YYYY-MM-DD)', 'Day of Week', 'Employee', 'Clock In Time', 'Clock Out Time', 
            'Work Duration (Hours)', 'Break Duration (Minutes)', 'Total Time (Hours)', 'Location', 'Status', 'Notes'
        ])
        
        # Write data rows
        for entry in entries:
            # Calculate total time including breaks
            work_hours = round(entry.duration / 60, 2) if entry.duration else 0.00
            break_minutes = entry.break_duration or 0
            total_hours = round((entry.duration + break_minutes) / 60, 2) if entry.duration else 0.00
            
            # Status determination
            status = 'Active' if entry.is_active else 'Completed'
            
            # Convert times to user's timezone for display
            try:
                user_clock_in = convert_utc_to_user_timezone(entry.clock_in, current_user.timezone) if entry.clock_in else None
                user_clock_out = convert_utc_to_user_timezone(entry.clock_out, current_user.timezone) if entry.clock_out else None
                user_date = user_clock_in.date() if user_clock_in else entry.date
                
                # Format times safely
                clock_in_str = user_clock_in.strftime('%I:%M %p') if user_clock_in else 'No Clock In'
                clock_out_str = user_clock_out.strftime('%I:%M %p') if user_clock_out else ('Still Active' if entry.is_active else 'No Clock Out')
            except Exception as e:
                # Fallback formatting if timezone conversion fails
                clock_in_str = entry.clock_in.strftime('%I:%M %p') if entry.clock_in else 'No Clock In'
                clock_out_str = entry.clock_out.strftime('%I:%M %p') if entry.clock_out else ('Still Active' if entry.is_active else 'No Clock Out')
                user_date = entry.date
            
            writer.writerow([
                user_date.strftime('%Y-%m-%d'),  # Date in user's timezone
                user_date.strftime('%A'),       # Day of week in user's timezone
                entry.user.username,
                clock_in_str,  # Safe clock in time
                clock_out_str,  # Safe clock out time
                f"{work_hours:.2f}",
                break_minutes,
                f"{total_hours:.2f}",
                entry.location or 'Office',
                status,
                entry.notes or ''
            ])
        
        csv_content = output.getvalue()
        output.close()
        
        # Generate filename
        if user_id and current_user.is_admin:
            user = User.query.get(user_id)
            filename = f"timesheet_{user.username}_{datetime.now().strftime('%Y%m%d')}.csv"
        else:
            filename = f"timesheet_{current_user.username}_{datetime.now().strftime('%Y%m%d')}.csv"
        
        from flask import Response
        return Response(
            csv_content,
            mimetype='text/csv',
            headers={'Content-Disposition': f'attachment; filename={filename}'}
        )
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
