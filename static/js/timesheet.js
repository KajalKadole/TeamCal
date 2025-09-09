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
    document.getElementById('breakBtn').addEventListener('click', startBreak);
    
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
    
    if (!clockedInView || !clockedOutView) {
        console.error('Required timesheet elements not found');
        return;
    }
    
    if (currentStatus && currentStatus.is_clocked_in) {
        clockedInView.style.display = 'block';
        clockedOutView.style.display = 'none';
        
        // Update clock in time - show exact login time
        const clockInTime = new Date(currentStatus.clock_in);
        document.getElementById('clockInTime').textContent = 
            clockInTime.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hour12: true});
        
        // Update location
        document.getElementById('currentLocation').textContent = currentStatus.location || 'Office';
        
        // Update break duration display
        const breakMinutes = currentStatus.total_break_duration || 0;
        const breakHours = Math.floor(breakMinutes / 60);
        const breakMins = breakMinutes % 60;
        document.getElementById('breakDurationDisplay').textContent = 
            `${breakHours.toString().padStart(2, '0')}:${breakMins.toString().padStart(2, '0')}`;
        
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
                
            // Update break duration display if it exists
            if (document.getElementById('breakDurationDisplay')) {
                const breakMinutes = currentStatus.total_break_duration || 0;
                const breakHours = Math.floor(breakMinutes / 60);
                const breakMins = breakMinutes % 60;
                document.getElementById('breakDurationDisplay').textContent = 
                    `${breakHours.toString().padStart(2, '0')}:${breakMins.toString().padStart(2, '0')}`;
            }
            
            // Check for auto-checkout every 30 seconds
            if (minutes % 1 === 0 && new Date().getSeconds() < 2) {
                checkAutoCheckout();
            }
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
            showAlert(data.message || 'Status updated!', 'success');
            // Immediately refresh status and entries to show changes
            loadTimesheetStatus();
            loadTimesheetEntries();
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
    const startDatePicker = document.getElementById('startDatePicker');
    const endDatePicker = document.getElementById('endDatePicker');
    
    let startDate, endDate;
    
    // Use date picker values if available, otherwise default to current month
    if (startDatePicker && endDatePicker && startDatePicker.value && endDatePicker.value) {
        startDate = startDatePicker.value;
        endDate = endDatePicker.value;
    } else {
        // Default to current month
        const currentDate = new Date();
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        
        startDate = startOfMonth.toISOString().split('T')[0];
        endDate = endOfMonth.toISOString().split('T')[0];
        
        // Set default values in date pickers if they exist
        if (startDatePicker && endDatePicker) {
            startDatePicker.value = startDate;
            endDatePicker.value = endDate;
        }
    }
    
    const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate
    });
    
    fetch(`/api/timesheet/entries?${params}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateTimesheetTable(data.entries);
                calculateStats(data.entries);
                updateSummaryStats(data.entries, startDate, endDate);
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
        // Ensure duration is a valid number
        const duration = parseFloat(entry.duration) || 0;
        
        if (entryDate.toDateString() === today) {
            todayMinutes += duration;
        }
        
        if (entryDate >= thisWeek) {
            weekMinutes += duration;
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
    // Use the selected date range from the UI, or default to current month
    const startDatePicker = document.getElementById('startDatePicker');
    const endDatePicker = document.getElementById('endDatePicker');
    
    let startDate, endDate;
    
    if (startDatePicker && endDatePicker && startDatePicker.value && endDatePicker.value) {
        startDate = startDatePicker.value;
        endDate = endDatePicker.value;
    } else {
        // Default to current month
        const currentDate = new Date();
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        
        startDate = startOfMonth.toISOString().split('T')[0];
        endDate = endOfMonth.toISOString().split('T')[0];
    }
    
    const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate
    });
    
    // Open the download URL directly to trigger file download
    window.open(`/api/timesheet/download?${params}`, '_blank');
}

// Break functionality - only starts breaks, ending is handled by status changes
function startBreak() {
    if (!currentStatus || !currentStatus.is_clocked_in) {
        showAlert('You must be clocked in to start a break', 'warning');
        return;
    }
    
    if (currentStatus.is_on_break) {
        showAlert('You are already on break. Change your status to "Available" to end the break.', 'info');
        return;
    }
    
    const breakType = document.getElementById('statusSelect')?.value || 'Break';
    
    fetch('/api/timesheet/start-break', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            break_type: breakType
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert(data.message, 'success');
            // Set status to "On Break" in the UI
            const statusSelect = document.getElementById('statusSelect');
            if (statusSelect) {
                statusSelect.value = 'On Break';
            }
            loadTimesheetStatus(); // Refresh status
            loadTimesheetEntries(); // Refresh entries
        } else {
            showAlert('Error: ' + data.error, 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('Failed to start break', 'danger');
    });
}

function downloadCSV(entries) {
    const headers = ['Date (YYYY-MM-DD)', 'Day of Week', 'Employee', 'Clock In Time', 'Clock Out Time', 'Work Duration (Hours)', 'Break Duration (Minutes)', 'Total Time (Hours)', 'Location', 'Status', 'Notes'];
    const csvContent = [
        headers.join(','),
        ...entries.map(entry => {
            const entryDate = new Date(entry.date);
            const clockInDate = entry.clock_in ? new Date(entry.clock_in) : null;
            const clockOutDate = entry.clock_out ? new Date(entry.clock_out) : null;
            
            // Safe time formatting
            const clockInStr = clockInDate ? clockInDate.toLocaleTimeString('en-US', { 
                hour12: true, 
                hour: '2-digit', 
                minute: '2-digit'
            }) : 'No Clock In';
            
            const clockOutStr = clockOutDate ? clockOutDate.toLocaleTimeString('en-US', { 
                hour12: true, 
                hour: '2-digit', 
                minute: '2-digit'
            }) : (entry.is_active ? 'Still Active' : 'No Clock Out');
            
            return [
                entryDate.toISOString().split('T')[0], // Date in YYYY-MM-DD format
                entryDate.toLocaleDateString('en-US', { weekday: 'long' }), // Day of week
                entry.username || 'Unknown', // Employee name
                clockInStr,
                clockOutStr,
                entry.duration > 0 ? (entry.duration / 60).toFixed(2) : '0.00',
                entry.break_duration || 0,
                entry.duration > 0 ? ((entry.duration + (entry.break_duration || 0)) / 60).toFixed(2) : '0.00',
                entry.location || 'Office',
                entry.is_active ? 'Active' : 'Completed',
                entry.notes || ''
            ].map(field => `"${field}"`).join(',');
        })
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `timesheet_${new Date().getFullYear()}_${String(new Date().getMonth() + 1).padStart(2, '0')}.csv`;
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

// Summary statistics calculation
function updateSummaryStats(entries, startDate, endDate) {
    let totalMinutes = 0;
    let totalBreakMinutes = 0;
    let daysWorked = new Set();
    
    entries.forEach(entry => {
        if (entry.duration && entry.duration > 0) {
            totalMinutes += entry.duration;
            daysWorked.add(entry.date);
        }
        if (entry.break_duration) {
            totalBreakMinutes += entry.break_duration;
        }
    });
    
    const totalHours = (totalMinutes / 60).toFixed(1);
    const avgHoursPerDay = daysWorked.size > 0 ? (totalMinutes / 60 / daysWorked.size).toFixed(1) : 0;
    
    // Update summary display
    const totalHoursEl = document.getElementById('totalHoursWorked');
    const daysWorkedEl = document.getElementById('totalDaysWorked');
    const avgHoursEl = document.getElementById('avgHoursPerDay');
    const breakTimeEl = document.getElementById('totalBreakTime');
    
    if (totalHoursEl) totalHoursEl.textContent = totalHours;
    if (daysWorkedEl) daysWorkedEl.textContent = daysWorked.size;
    if (avgHoursEl) avgHoursEl.textContent = avgHoursPerDay;
    if (breakTimeEl) breakTimeEl.textContent = totalBreakMinutes;
}

// Quick date selection handler
function handleQuickDateSelect() {
    const quickSelect = document.getElementById('quickDateSelect');
    const startPicker = document.getElementById('startDatePicker');
    const endPicker = document.getElementById('endDatePicker');
    
    if (!quickSelect || !startPicker || !endPicker) return;
    
    const today = new Date();
    let startDate, endDate;
    
    switch (quickSelect.value) {
        case 'current_month':
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            break;
        case 'last_month':
            startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            endDate = new Date(today.getFullYear(), today.getMonth(), 0);
            break;
        case 'current_week':
            const dayOfWeek = today.getDay();
            startDate = new Date(today);
            startDate.setDate(today.getDate() - dayOfWeek);
            endDate = new Date(today);
            endDate.setDate(today.getDate() + (6 - dayOfWeek));
            break;
        case 'last_week':
            const lastWeekStart = new Date(today);
            lastWeekStart.setDate(today.getDate() - today.getDay() - 7);
            startDate = lastWeekStart;
            endDate = new Date(lastWeekStart);
            endDate.setDate(lastWeekStart.getDate() + 6);
            break;
        case 'last_7_days':
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 7);
            endDate = today;
            break;
        case 'last_30_days':
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 30);
            endDate = today;
            break;
        case 'current_year':
            startDate = new Date(today.getFullYear(), 0, 1);
            endDate = new Date(today.getFullYear(), 11, 31);
            break;
        default:
            return;
    }
    
    startPicker.value = startDate.toISOString().split('T')[0];
    endPicker.value = endDate.toISOString().split('T')[0];
}

// Auto-checkout after 6 hours
function checkAutoCheckout() {
    if (!currentStatus || !currentStatus.is_clocked_in) return;
    
    const clockInTime = new Date(currentStatus.clock_in);
    const now = new Date();
    const hoursWorked = (now - clockInTime) / (1000 * 60 * 60); // Convert to hours
    
    // Auto checkout after 6 hours
    if (hoursWorked >= 6) {
        showAlert('You have been automatically clocked out after 6 hours of work time.', 'info');
        
        // Automatically clock out with summary
        const notes = 'Auto checkout after 6 hours';
        const task = currentStatus.current_task || 'Work completed';
        
        const data = {
            notes: notes,
            task: task
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
                loadTimesheetStatus();
                loadTimesheetEntries();
            }
        })
        .catch(error => {
            console.error('Auto checkout error:', error);
        });
    }
}

// Initialize additional timesheet functionality
document.addEventListener('DOMContentLoaded', function() {
    // Set up event listeners for new controls
    const quickSelect = document.getElementById('quickDateSelect');
    const filterBtn = document.getElementById('filterTimesheetBtn');
    
    if (quickSelect) {
        quickSelect.addEventListener('change', handleQuickDateSelect);
    }
    
    if (filterBtn) {
        filterBtn.addEventListener('click', loadTimesheetEntries);
    }
    
    // Add auto-checkout check to existing refresh interval
    const originalSetInterval = setInterval;
    const intervals = [];
    
    // Override setInterval to track intervals
    setInterval = function(func, delay) {
        const id = originalSetInterval(function() {
            func();
            // Add auto-checkout check to timesheet status refresh
            if (func.toString().includes('loadTimesheetStatus')) {
                checkAutoCheckout();
            }
        }, delay);
        intervals.push(id);
        return id;
    };
});