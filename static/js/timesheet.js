// Timesheet JavaScript functionality
let currentStatus = null;
let durationInterval = null;

// Initialize timesheet when page loads
document.addEventListener('DOMContentLoaded', function() {
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    
    loadTimesheetStatus();
    loadTimesheetEntries();
    
    if (window.currentUser && window.currentUser.is_admin) {
        loadTeamStatus();
        setInterval(loadTeamStatus, 30000); // Refresh every 30 seconds
    }
    
    // Event listeners
    document.getElementById('clockInBtn').addEventListener('click', clockIn);
    document.getElementById('clockOutBtn').addEventListener('click', showClockOutModal);
    document.getElementById('updateStatusBtn').addEventListener('click', updateStatus);
    
    // Auto-refresh status every minute
    setInterval(loadTimesheetStatus, 60000);
});

function updateCurrentTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
    const dateString = now.toLocaleDateString([], {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    document.getElementById('currentTime').innerHTML = 
        `<strong>${timeString}</strong><br><small>${dateString}</small>`;
}

function loadTimesheetStatus() {
    fetch('/api/timesheet/status')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                currentStatus = data;
                updateUI();
            } else {
                showAlert('Error loading timesheet status: ' + data.error, 'danger');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('Failed to load timesheet status', 'danger');
        });
}

function updateUI() {
    const clockedInView = document.getElementById('clockedInView');
    const clockedOutView = document.getElementById('clockedOutView');
    
    if (currentStatus.is_clocked_in) {
        clockedInView.style.display = 'block';
        clockedOutView.style.display = 'none';
        
        // Update clock in time
        const clockInTime = new Date(currentStatus.clock_in);
        document.getElementById('clockInTime').textContent = 
            clockInTime.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hour12: true});
        
        // Update location
        document.getElementById('currentLocation').textContent = currentStatus.location || 'Office';
        
        // Update status and task inputs
        document.getElementById('statusSelect').value = currentStatus.status_message || 'Available';
        document.getElementById('currentTaskInput').value = currentStatus.current_task || '';
        
        // Start duration counter
        startDurationCounter();
    } else {
        clockedInView.style.display = 'none';
        clockedOutView.style.display = 'block';
        
        if (durationInterval) {
            clearInterval(durationInterval);
            durationInterval = null;
        }
    }
}

function startDurationCounter() {
    if (durationInterval) {
        clearInterval(durationInterval);
    }
    
    durationInterval = setInterval(() => {
        if (currentStatus && currentStatus.is_clocked_in) {
            const clockInTime = new Date(currentStatus.clock_in);
            const now = new Date();
            const diffMs = now - clockInTime;
            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            
            document.getElementById('currentDuration').textContent = 
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

function clockIn() {
    const location = document.getElementById('locationSelect').value;
    const task = document.getElementById('initialTask').value;
    
    const data = {
        location: location,
        task: task
    };
    
    fetch('/api/timesheet/clock-in', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert('Successfully clocked in!', 'success');
            loadTimesheetStatus();
            loadTimesheetEntries();
            
            // Clear initial task field
            document.getElementById('initialTask').value = '';
        } else {
            showAlert('Error clocking in: ' + data.error, 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('Failed to clock in', 'danger');
    });
}

function showClockOutModal() {
    const modal = new bootstrap.Modal(document.getElementById('clockOutModal'));
    
    // Calculate current duration for display
    if (currentStatus && currentStatus.is_clocked_in) {
        const clockInTime = new Date(currentStatus.clock_in);
        const now = new Date();
        const diffMs = now - clockInTime;
        const totalMinutes = Math.floor(diffMs / (1000 * 60));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        
        document.getElementById('finalDuration').textContent = 
            `${hours} hours ${minutes} minutes`;
    }
    
    modal.show();
}

function confirmClockOut() {
    const breakDuration = parseInt(document.getElementById('breakDuration').value) || 0;
    const notes = document.getElementById('clockOutNotes').value;
    
    const data = {
        break_duration: breakDuration,
        notes: notes
    };
    
    fetch('/api/timesheet/clock-out', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert('Successfully clocked out!', 'info');
            bootstrap.Modal.getInstance(document.getElementById('clockOutModal')).hide();
            
            // Clear fields
            document.getElementById('breakDuration').value = '0';
            document.getElementById('clockOutNotes').value = '';
            
            loadTimesheetStatus();
            loadTimesheetEntries();
        } else {
            showAlert('Error clocking out: ' + data.error, 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('Failed to clock out', 'danger');
    });
}

function updateStatus() {
    const statusMessage = document.getElementById('statusSelect').value;
    const currentTask = document.getElementById('currentTaskInput').value;
    
    const data = {
        status_message: statusMessage,
        current_task: currentTask
    };
    
    fetch('/api/timesheet/update-status', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert('Status updated!', 'success');
            if (window.currentUser && window.currentUser.is_admin) {
                loadTeamStatus(); // Refresh team status if admin
            }
        } else {
            showAlert('Error updating status: ' + data.error, 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('Failed to update status', 'danger');
    });
}

function loadTeamStatus() {
    if (!window.currentUser || !window.currentUser.is_admin) return;
    
    fetch('/api/team/status')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateTeamStatusDisplay(data.team_status);
            } else {
                console.error('Error loading team status:', data.error);
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

function updateTeamStatusDisplay(teamStatus) {
    const container = document.getElementById('teamStatusList');
    
    if (teamStatus.length === 0) {
        container.innerHTML = '<div class="text-center text-muted">No team members found</div>';
        return;
    }
    
    let html = '';
    teamStatus.forEach(member => {
        const statusClass = member.is_clocked_in ? 'success' : 'secondary';
        const statusIcon = member.is_clocked_in ? 'fa-circle' : 'fa-circle-o';
        const statusText = member.is_clocked_in ? member.status_message : 'Offline';
        
        let durationText = '';
        if (member.is_clocked_in && member.current_duration > 0) {
            const hours = Math.floor(member.current_duration / 60);
            const minutes = Math.floor(member.current_duration % 60);
            durationText = `<small class="text-muted">${hours}h ${minutes}m</small>`;
        }
        
        html += `
            <div class="d-flex justify-content-between align-items-center mb-2 p-2 rounded" style="background-color: var(--bs-dark);">
                <div class="d-flex align-items-center">
                    <i class="fas ${statusIcon} text-${statusClass} me-2"></i>
                    <div>
                        <strong>${member.username}</strong>
                        <div class="small text-muted">${statusText}</div>
                        ${member.current_task ? `<div class="small text-info">${member.current_task}</div>` : ''}
                    </div>
                </div>
                <div class="text-end">
                    ${durationText}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function loadTimesheetEntries() {
    const currentDate = new Date();
    const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    const params = new URLSearchParams({
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0]
    });
    
    fetch(`/api/timesheet/entries?${params}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateTimesheetTable(data.entries);
                calculateStats(data.entries);
            } else {
                showAlert('Error loading timesheet entries: ' + data.error, 'danger');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('Failed to load timesheet entries', 'danger');
        });
}

function updateTimesheetTable(entries) {
    const tbody = document.getElementById('timesheetTableBody');
    
    if (entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No timesheet entries found</td></tr>';
        return;
    }
    
    let html = '';
    entries.forEach(entry => {
        const date = new Date(entry.date).toLocaleDateString();
        const clockIn = entry.clock_in ? new Date(entry.clock_in).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hour12: true}) : '--';
        const clockOut = entry.clock_out ? new Date(entry.clock_out).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hour12: true}) : '--';
        
        const duration = entry.duration > 0 ? 
            `${Math.floor(entry.duration / 60)}h ${entry.duration % 60}m` : 
            (entry.is_active ? 'Active' : '--');
        
        const statusBadge = entry.is_active ? 
            '<span class="badge bg-success">Active</span>' : 
            '<span class="badge bg-secondary">Completed</span>';
        
        html += `
            <tr>
                <td>${date}</td>
                <td>${clockIn}</td>
                <td>${clockOut}</td>
                <td>${duration}</td>
                <td>${entry.location || 'Office'}</td>
                <td>${entry.notes || '--'}</td>
                <td>${statusBadge}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

function calculateStats(entries) {
    const today = new Date().toDateString();
    const thisWeek = getStartOfWeek(new Date());
    
    let todayMinutes = 0;
    let weekMinutes = 0;
    
    entries.forEach(entry => {
        const entryDate = new Date(entry.date);
        
        if (entryDate.toDateString() === today) {
            todayMinutes += entry.duration;
        }
        
        if (entryDate >= thisWeek) {
            weekMinutes += entry.duration;
        }
    });
    
    document.getElementById('todayHours').textContent = (todayMinutes / 60).toFixed(1);
    document.getElementById('weekHours').textContent = (weekMinutes / 60).toFixed(1);
}

function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
}

function downloadTimesheet() {
    // Use the server-side CSV download endpoint
    const currentDate = new Date();
    const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    const params = new URLSearchParams({
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0]
    });
    
    // Open the download URL directly to trigger file download
    window.open(`/api/timesheet/download?${params}`, '_blank');
}

function downloadCSV(entries) {
    const headers = ['Date', 'Clock In', 'Clock Out', 'Duration (Hours)', 'Location', 'Notes'];
    const csvContent = [
        headers.join(','),
        ...entries.map(entry => [
            entry.date,
            entry.clock_in ? new Date(entry.clock_in).toLocaleString() : '',
            entry.clock_out ? new Date(entry.clock_out).toLocaleString() : '',
            entry.duration ? (entry.duration / 60).toFixed(2) : '',
            `"${entry.location || ''}"`,
            `"${(entry.notes || '').replace(/"/g, '""')}"`
        ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `timesheet_${new Date().getFullYear()}_${new Date().getMonth() + 1}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showAlert('Timesheet downloaded successfully!', 'success');
}

// Utility function for showing alerts
function showAlert(message, type) {
    const alertContainer = document.querySelector('.container');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    alertContainer.insertBefore(alert, alertContainer.firstChild);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 5000);
}