from flask import render_template, flash, redirect, url_for, request, jsonify
from flask_login import login_user, logout_user, current_user, login_required
from werkzeug.security import generate_password_hash, check_password_hash
from app import app, db
from models import User, AvailabilitySlot, BusySlot, LeaveDay, TimesheetEntry, UserStatus
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
        
        # Create new timesheet entry
        entry = TimesheetEntry(
            user_id=current_user.id,
            date=datetime.now().date(),
            clock_in=datetime.now(),
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
        user_status.last_activity = datetime.now()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'entry_id': entry.id,
            'clock_in': entry.clock_in.isoformat(),
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
        
        # Update timesheet entry
        entry.clock_out = datetime.now()
        entry.break_duration = data.get('break_duration', 0)
        if data.get('notes'):
            entry.notes = data.get('notes')
        
        # Update user status
        user_status = UserStatus.query.filter_by(user_id=current_user.id).first()
        if user_status:
            user_status.is_working = False
            user_status.current_timesheet_id = None
            user_status.status_message = 'Offline'
            user_status.current_task = ''
            user_status.last_activity = datetime.now()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'entry_id': entry.id,
            'clock_out': entry.clock_out.isoformat(),
            'duration': entry.duration,
            'status': 'clocked_out'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/timesheet/status', methods=['GET'])
@login_required
def get_timesheet_status():
    """Get current timesheet status for user"""
    try:
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
                'current_duration': (datetime.now() - active_entry.clock_in).total_seconds() / 60,
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
        
        if 'status_message' in data:
            user_status.status_message = data['status_message']
        if 'current_task' in data:
            user_status.current_task = data['current_task']
        
        user_status.last_activity = datetime.now()
        
        db.session.commit()
        
        return jsonify({'success': True})
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
        
        # Get all users with their status
        users_query = db.session.query(User, UserStatus).outerjoin(UserStatus).all()
        
        team_status = []
        for user, status in users_query:
            # Check for active timesheet
            active_entry = TimesheetEntry.query.filter_by(
                user_id=user.id,
                clock_out=None
            ).first()
            
            team_status.append({
                'user_id': user.id,
                'username': user.username,
                'is_working': status.is_working if status else False,
                'is_clocked_in': active_entry is not None,
                'status_message': status.status_message if status else 'Offline',
                'current_task': status.current_task if status else '',
                'last_activity': status.last_activity.isoformat() if status and status.last_activity else None,
                'clock_in_time': active_entry.clock_in.isoformat() if active_entry else None,
                'current_duration': (datetime.now() - active_entry.clock_in).total_seconds() / 60 if active_entry else 0
            })
        
        return jsonify({'success': True, 'team_status': team_status})
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
            entries_data.append({
                'id': entry.id,
                'user_id': entry.user_id,
                'username': entry.user.username,
                'date': entry.date.isoformat(),
                'clock_in': entry.clock_in.isoformat(),
                'clock_out': entry.clock_out.isoformat() if entry.clock_out else None,
                'duration': entry.duration,
                'break_duration': entry.break_duration,
                'location': entry.location,
                'notes': entry.notes,
                'is_active': entry.is_active
            })
        
        return jsonify({'success': True, 'entries': entries_data})
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
            'Date', 'Employee', 'Clock In', 'Clock Out', 'Duration (Hours)', 
            'Break Duration (Minutes)', 'Location', 'Notes'
        ])
        
        # Write data rows
        for entry in entries:
            writer.writerow([
                entry.date.strftime('%Y-%m-%d'),
                entry.user.username,
                entry.clock_in.strftime('%H:%M:%S'),
                entry.clock_out.strftime('%H:%M:%S') if entry.clock_out else 'Still Active',
                f"{entry.duration:.2f}" if entry.duration else '0.00',
                entry.break_duration or 0,
                entry.location,
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
