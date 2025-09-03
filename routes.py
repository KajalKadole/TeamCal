from flask import render_template, flash, redirect, url_for, request, jsonify
from flask_login import login_user, logout_user, current_user, login_required
from werkzeug.security import generate_password_hash, check_password_hash
from app import app, db
from models import User, AvailabilitySlot, BusySlot, LeaveDay
from forms import LoginForm, RegistrationForm, AvailabilityForm, BusySlotForm, LeaveDayForm, ProfileForm, AddEmployeeForm
from datetime import datetime, date, time
import json

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
            password_hash=generate_password_hash(form.password.data)
        )
        db.session.add(user)
        db.session.commit()
        flash('Registration successful! You can now log in.', 'success')
        return redirect(url_for('login'))
    
    return render_template('register.html', form=form)

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
    return render_template('calendar.html', users=users)

@app.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    form = ProfileForm()
    
    if form.validate_on_submit():
        current_user.username = form.username.data
        current_user.email = form.email.data
        if form.default_start_time.data:
            current_user.default_start_time = form.default_start_time.data.strftime('%H:%M')
        if form.default_end_time.data:
            current_user.default_end_time = form.default_end_time.data.strftime('%H:%M')
        
        db.session.commit()
        flash('Profile updated successfully!', 'success')
        return redirect(url_for('profile'))
    
    # Pre-populate form with current user data
    if request.method == 'GET':
        form.username.data = current_user.username
        form.email.data = current_user.email
        if current_user.default_start_time:
            form.default_start_time.data = datetime.strptime(current_user.default_start_time, '%H:%M').time()
        if current_user.default_end_time:
            form.default_end_time.data = datetime.strptime(current_user.default_end_time, '%H:%M').time()
    
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
            password_hash=generate_password_hash(form.password.data)
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
@app.route('/api/events')
@login_required
def get_events():
    start_date = request.args.get('start')
    end_date = request.args.get('end')
    user_filter = request.args.get('user_id')
    
    events = []
    
    # Determine which users to show
    if current_user.is_admin and user_filter:
        if user_filter == 'all':
            users = User.query.all()
        else:
            users = [User.query.get(int(user_filter))]
    elif current_user.is_admin:
        users = User.query.all()
    else:
        users = [current_user]
    
    for user in users:
        # Availability slots
        availability_slots = AvailabilitySlot.query.filter_by(user_id=user.id).all()
        for slot in availability_slots:
            events.append({
                'id': f'avail-{slot.id}',
                'title': f'{user.username} - Available',
                'start': f'{slot.date}T{slot.start_time}',
                'end': f'{slot.date}T{slot.end_time}',
                'color': '#28a745',
                'user_id': user.id,
                'type': 'availability'
            })
        
        # Busy slots
        busy_slots = BusySlot.query.filter_by(user_id=user.id).all()
        for slot in busy_slots:
            events.append({
                'id': f'busy-{slot.id}',
                'title': f'{user.username} - {slot.title}',
                'start': f'{slot.date}T{slot.start_time}',
                'end': f'{slot.date}T{slot.end_time}',
                'color': '#dc3545',
                'user_id': user.id,
                'type': 'busy',
                'description': slot.description
            })
        
        # Leave days
        leave_days = LeaveDay.query.filter_by(user_id=user.id).all()
        for leave in leave_days:
            events.append({
                'id': f'leave-{leave.id}',
                'title': f'{user.username} - {leave.leave_type}',
                'start': f'{leave.date}',
                'allDay': True,
                'color': '#ffc107',
                'user_id': user.id,
                'type': 'leave',
                'notes': leave.notes
            })
    
    return jsonify(events)

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
