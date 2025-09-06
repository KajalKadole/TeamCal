let calendar;
let currentEventType = null;
let selectedEvent = null;
let allEvents = [];

document.addEventListener('DOMContentLoaded', function() {
    const calendarEl = document.getElementById('calendar');
    
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        height: 'auto',
        slotLabelFormat: {
            hour: 'numeric',
            minute: '2-digit',
            omitZeroMinute: false,
            meridiem: 'short'
        },
        eventTimeFormat: {
            hour: 'numeric',
            minute: '2-digit',
            meridiem: 'short'
        },
        events: function(fetchInfo, successCallback, failureCallback) {
            fetch('/api/events')
                .then(response => response.json())
                .then(data => {
                    allEvents = data;
                    updateTeamMemberCounts(data);
                    successCallback(data);
                })
                .catch(error => {
                    console.error('Error fetching events:', error);
                    failureCallback(error);
                });
        },
        eventClick: function(info) {
            showEventDetails(info.event);
        },
        dateClick: function(info) {
            // Pre-fill date when clicking on calendar
            document.getElementById('eventDate').value = info.dateStr;
        },
        eventDidMount: function(info) {
            // Add tooltips to events
            info.el.setAttribute('title', info.event.title);
            
            // Add custom classes based on event type
            const eventType = info.event.extendedProps.type;
            if (eventType) {
                info.el.classList.add(`calendar-event-${eventType}`);
            }
        },
        dayCellDidMount: function(info) {
            // Add team member info to each day cell
            addTeamMemberInfoToDay(info);
        },
        loading: function(isLoading) {
            // Show loading indicator
            const calendarContainer = document.querySelector('.card-body');
            if (isLoading) {
                calendarContainer.classList.add('loading');
            } else {
                calendarContainer.classList.remove('loading');
            }
        }
    });
    
    calendar.render();
    
    // Set up user filter for admin users
    const userFilter = document.getElementById('userFilter');
    if (userFilter) {
        userFilter.addEventListener('change', function() {
            const userId = this.value;
            if (userId === 'all') {
                fetch('/api/events')
                    .then(response => response.json())
                    .then(data => {
                        allEvents = data;
                        calendar.removeAllEventSources();
                        calendar.addEventSource(data);
                        updateTeamMemberCounts(data);
                    });
            } else {
                fetch(`/api/events?user_id=${userId}`)
                    .then(response => response.json())
                    .then(data => {
                        allEvents = data;
                        calendar.removeAllEventSources();
                        calendar.addEventSource(data);
                        updateTeamMemberCounts(data);
                    });
            }
        });
    }
    
    // Initialize modal event handlers
    initializeModalHandlers();
});

function initializeModalHandlers() {
    // Set up form submission
    document.getElementById('addEventForm').addEventListener('submit', function(e) {
        e.preventDefault();
        addEvent();
    });
    
    // Pre-fill current date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('eventDate').value = today;
    
    // Set default times from user profile or reasonable defaults
    setTimeSelectors('start', 9, 0, 'AM');
    setTimeSelectors('end', 5, 0, 'PM');
}

function showAddModal(eventType) {
    currentEventType = eventType;
    const modal = new bootstrap.Modal(document.getElementById('addEventModal'));
    
    // Update modal title and show relevant fields
    const modalTitle = document.getElementById('modalTitle');
    const timeFields = document.getElementById('timeFields');
    const titleField = document.getElementById('titleField');
    const leaveTypeField = document.getElementById('leaveTypeField');
    const descriptionField = document.getElementById('descriptionField');
    
    // Reset form
    document.getElementById('addEventForm').reset();
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('eventDate').value = today;
    
    // Configure modal based on event type
    switch (eventType) {
        case 'availability':
            modalTitle.textContent = 'Add Availability';
            timeFields.style.display = 'block';
            titleField.style.display = 'none';
            leaveTypeField.style.display = 'none';
            descriptionField.style.display = 'none';
            setTimeSelectors('start', 9, 0, 'AM');
            setTimeSelectors('end', 5, 0, 'PM');
            break;
            
        case 'busy':
            modalTitle.textContent = 'Mark as Busy';
            timeFields.style.display = 'block';
            titleField.style.display = 'block';
            leaveTypeField.style.display = 'none';
            descriptionField.style.display = 'block';
            document.getElementById('eventTitle').value = 'Meeting';
            setTimeSelectors('start', 10, 0, 'AM');
            setTimeSelectors('end', 11, 0, 'AM');
            break;
            
        case 'leave':
            modalTitle.textContent = 'Request Leave';
            timeFields.style.display = 'none';
            titleField.style.display = 'none';
            leaveTypeField.style.display = 'block';
            descriptionField.style.display = 'block';
            document.getElementById('leaveType').value = 'Leave';
            break;
    }
    
    modal.show();
}

function addEvent() {
    const eventData = {
        date: document.getElementById('eventDate').value,
        type: currentEventType
    };
    
    // Add type-specific data
    switch (currentEventType) {
        case 'availability':
            eventData.start_time = getTimeFrom12Hour('start');
            eventData.end_time = getTimeFrom12Hour('end');
            break;
            
        case 'busy':
            eventData.start_time = getTimeFrom12Hour('start');
            eventData.end_time = getTimeFrom12Hour('end');
            eventData.title = document.getElementById('eventTitle').value || 'Busy';
            eventData.description = document.getElementById('eventDescription').value;
            break;
            
        case 'leave':
            eventData.leave_type = document.getElementById('leaveType').value;
            eventData.notes = document.getElementById('eventDescription').value;
            break;
    }
    
    // Validate required fields
    if (!eventData.date) {
        showAlert('Please select a date.', 'danger');
        return;
    }
    
    if ((currentEventType === 'availability' || currentEventType === 'busy') && 
        (!eventData.start_time || !eventData.end_time)) {
        showAlert('Please select start and end times.', 'danger');
        return;
    }
    
    if (currentEventType !== 'leave' && eventData.start_time >= eventData.end_time) {
        showAlert('End time must be after start time.', 'danger');
        return;
    }
    
    // Submit the event
    const endpoint = `/api/${currentEventType}`;
    
    fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert(`${capitalizeFirst(currentEventType)} added successfully!`, 'success');
            // Refetch events and update team member counts
            fetch('/api/events')
                .then(response => response.json())
                .then(events => {
                    allEvents = events;
                    updateTeamMemberCounts(events);
                    calendar.refetchEvents();
                });
            bootstrap.Modal.getInstance(document.getElementById('addEventModal')).hide();
        } else {
            showAlert(`Error: ${data.error}`, 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('An error occurred while adding the event.', 'danger');
    });
}

function showEventDetails(event) {
    selectedEvent = event;
    const modal = new bootstrap.Modal(document.getElementById('eventDetailsModal'));
    const detailsContainer = document.getElementById('eventDetails');
    
    let html = `
        <div class="mb-3">
            <h5>${event.title}</h5>
            <p class="text-muted mb-1">
                <i class="fas fa-calendar me-2"></i>
                ${formatDate(event.start)}
            </p>
    `;
    
    if (!event.allDay) {
        html += `
            <p class="text-muted mb-1">
                <i class="fas fa-clock me-2"></i>
                ${formatTime(event.start)} - ${formatTime(event.end)}
            </p>
        `;
    }
    
    if (event.extendedProps.description) {
        html += `
            <p class="mt-3">
                <strong>Description:</strong><br>
                ${event.extendedProps.description}
            </p>
        `;
    }
    
    if (event.extendedProps.notes) {
        html += `
            <p class="mt-3">
                <strong>Notes:</strong><br>
                ${event.extendedProps.notes}
            </p>
        `;
    }
    
    // Show edit and delete buttons only for current user's events or if admin
    const editBtn = document.getElementById('editEventBtn');
    const deleteBtn = document.getElementById('deleteEventBtn');
    const currentUserId = window.currentUser ? window.currentUser.id : 0;
    const isAdmin = window.currentUser ? window.currentUser.is_admin : false;
    
    if (event.extendedProps.user_id === currentUserId || isAdmin) {
        editBtn.style.display = 'inline-block';
        deleteBtn.style.display = 'inline-block';
    } else {
        editBtn.style.display = 'none';
        deleteBtn.style.display = 'none';
    }
    
    html += '</div>';
    detailsContainer.textContent = '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    detailsContainer.appendChild(tempDiv);
    modal.show();
}

function deleteEvent() {
    if (!selectedEvent) return;
    
    if (!confirm('Are you sure you want to delete this event?')) {
        return;
    }
    
    const eventId = selectedEvent.id;
    const eventType = selectedEvent.extendedProps.type;
    const actualId = eventId.split('-')[1]; // Remove prefix like 'avail-', 'busy-', 'leave-'
    
    fetch(`/api/events/${eventType}/${actualId}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert('Event deleted successfully!', 'success');
            // Refetch events and update team member counts
            fetch('/api/events')
                .then(response => response.json())
                .then(events => {
                    allEvents = events;
                    updateTeamMemberCounts(events);
                    calendar.refetchEvents();
                });
            bootstrap.Modal.getInstance(document.getElementById('eventDetailsModal')).hide();
        } else {
            showAlert(`Error: ${data.error}`, 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('An error occurred while deleting the event.', 'danger');
    });
}

function editEvent() {
    if (!selectedEvent) return;
    
    // Close the details modal
    bootstrap.Modal.getInstance(document.getElementById('eventDetailsModal')).hide();
    
    // Determine event type from the ID prefix
    const eventId = selectedEvent.id;
    const eventType = selectedEvent.extendedProps.type;
    
    // Set up the modal for editing
    const modal = new bootstrap.Modal(document.getElementById('addEventModal'));
    const modalTitle = document.getElementById('modalTitle');
    const timeFields = document.getElementById('timeFields');
    const titleField = document.getElementById('titleField');
    const leaveTypeField = document.getElementById('leaveTypeField');
    const descriptionField = document.getElementById('descriptionField');
    
    // Set current event type for editing
    currentEventType = eventType;
    
    // Pre-fill the form with current event data
    document.getElementById('eventDate').value = selectedEvent.start.toISOString().split('T')[0];
    
    // Configure modal based on event type
    switch (eventType) {
        case 'availability':
            modalTitle.textContent = 'Edit Availability';
            timeFields.style.display = 'block';
            titleField.style.display = 'none';
            leaveTypeField.style.display = 'none';
            descriptionField.style.display = 'none';
            
            // Set times for availability
            if (selectedEvent.start && selectedEvent.end) {
                setTimeSelectorsFromDate('start', selectedEvent.start);
                setTimeSelectorsFromDate('end', selectedEvent.end);
            }
            break;
            
        case 'busy':
            modalTitle.textContent = 'Edit Busy Period';
            timeFields.style.display = 'block';
            titleField.style.display = 'block';
            leaveTypeField.style.display = 'none';
            descriptionField.style.display = 'block';
            
            // Set times and details for busy slot
            if (selectedEvent.start && selectedEvent.end) {
                setTimeSelectorsFromDate('start', selectedEvent.start);
                setTimeSelectorsFromDate('end', selectedEvent.end);
            }
            
            // Extract title (remove username prefix)
            const titleParts = selectedEvent.title.split(' - ');
            document.getElementById('eventTitle').value = titleParts.length > 1 ? titleParts.slice(1).join(' - ') : titleParts[0];
            document.getElementById('eventDescription').value = selectedEvent.extendedProps.description || '';
            break;
            
        case 'leave':
            modalTitle.textContent = 'Edit Leave Request';
            timeFields.style.display = 'none';
            titleField.style.display = 'none';
            leaveTypeField.style.display = 'block';
            descriptionField.style.display = 'block';
            
            // Extract leave type from title
            const leaveTitleParts = selectedEvent.title.split(' - ');
            const leaveType = leaveTitleParts.length > 1 ? leaveTitleParts[1] : 'Leave';
            document.getElementById('leaveType').value = leaveType;
            document.getElementById('eventDescription').value = selectedEvent.extendedProps.notes || '';
            break;
    }
    
    // Change the button text to indicate editing
    const submitBtn = document.querySelector('#addEventModal .btn-primary');
    submitBtn.textContent = 'Update Event';
    submitBtn.onclick = updateEvent;
    
    modal.show();
}

function updateEvent() {
    const eventData = {
        date: document.getElementById('eventDate').value,
        type: currentEventType
    };
    
    // Add type-specific data
    switch (currentEventType) {
        case 'availability':
            eventData.start_time = getTimeFrom12Hour('start');
            eventData.end_time = getTimeFrom12Hour('end');
            break;
            
        case 'busy':
            eventData.start_time = getTimeFrom12Hour('start');
            eventData.end_time = getTimeFrom12Hour('end');
            eventData.title = document.getElementById('eventTitle').value || 'Busy';
            eventData.description = document.getElementById('eventDescription').value;
            break;
            
        case 'leave':
            eventData.leave_type = document.getElementById('leaveType').value;
            eventData.notes = document.getElementById('eventDescription').value;
            break;
    }
    
    // Validate required fields
    if (!eventData.date) {
        showAlert('Please select a date.', 'danger');
        return;
    }
    
    if ((currentEventType === 'availability' || currentEventType === 'busy') && 
        (!eventData.start_time || !eventData.end_time)) {
        showAlert('Please select start and end times.', 'danger');
        return;
    }
    
    if (currentEventType !== 'leave' && eventData.start_time >= eventData.end_time) {
        showAlert('End time must be after start time.', 'danger');
        return;
    }
    
    // Extract the actual ID from the selected event
    const actualId = selectedEvent.id.split('-')[1];
    const endpoint = `/api/events/${currentEventType}/${actualId}`;
    
    fetch(endpoint, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert(`${capitalizeFirst(currentEventType)} updated successfully!`, 'success');
            // Refetch events and update team member counts
            fetch('/api/events')
                .then(response => response.json())
                .then(events => {
                    allEvents = events;
                    updateTeamMemberCounts(events);
                    calendar.refetchEvents();
                });
            bootstrap.Modal.getInstance(document.getElementById('addEventModal')).hide();
            
            // Reset the button back to "Add Event"
            const submitBtn = document.querySelector('#addEventModal .btn-primary');
            submitBtn.textContent = 'Add Event';
            submitBtn.onclick = addEvent;
        } else {
            showAlert(`Error: ${data.error}`, 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('An error occurred while updating the event.', 'danger');
    });
}

// Helper functions for 12-hour time handling
function setTimeSelectors(prefix, hour, minute, ampm) {
    document.getElementById(`${prefix}Hour`).value = hour.toString();
    document.getElementById(`${prefix}Minute`).value = minute.toString().padStart(2, '0');
    document.getElementById(`${prefix}AmPm`).value = ampm;
}

function setTimeSelectorsFromDate(prefix, date) {
    let hour = date.getHours();
    const minute = date.getMinutes();
    const ampm = hour >= 12 ? 'PM' : 'AM';
    
    // Convert to 12-hour format
    if (hour === 0) hour = 12;
    else if (hour > 12) hour = hour - 12;
    
    setTimeSelectors(prefix, hour, minute, ampm);
}

function getTimeFrom12Hour(prefix) {
    const hour = parseInt(document.getElementById(`${prefix}Hour`).value);
    const minute = parseInt(document.getElementById(`${prefix}Minute`).value);
    const ampm = document.getElementById(`${prefix}AmPm`).value;
    
    if (!hour) return null;
    
    let hour24 = hour;
    if (ampm === 'AM' && hour === 12) {
        hour24 = 0;
    } else if (ampm === 'PM' && hour !== 12) {
        hour24 = hour + 12;
    }
    
    return `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

// Utility functions
function showAlert(message, type) {
    const alertContainer = document.querySelector('.container');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show mt-3`;
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn-close';
    closeBtn.setAttribute('data-bs-dismiss', 'alert');
    alert.appendChild(messageSpan);
    alert.appendChild(closeBtn);
    
    // Insert after the first child (usually the nav container)
    const firstCard = alertContainer.querySelector('.row');
    if (firstCard) {
        alertContainer.insertBefore(alert, firstCard);
    } else {
        alertContainer.insertBefore(alert, alertContainer.firstChild);
    }
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        if (alert && alert.parentNode) {
            alert.remove();
        }
    }, 5000);
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatTime(date) {
    return new Date(date).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

// Update team member status counters
function updateTeamMemberCounts(events) {
    // Reset all counters
    document.querySelectorAll('[id^="available-"], [id^="busy-"], [id^="leave-"]').forEach(el => {
        el.textContent = '0 ' + el.textContent.split(' ').slice(1).join(' ');
    });
    
    // Count events by user and type
    const counts = {};
    events.forEach(event => {
        const userId = event.user_id;
        const type = event.type;
        
        if (!counts[userId]) {
            counts[userId] = { availability: 0, busy: 0, leave: 0 };
        }
        counts[userId][type]++;
    });
    
    // Update the display
    Object.keys(counts).forEach(userId => {
        const availableEl = document.getElementById(`available-${userId}`);
        const busyEl = document.getElementById(`busy-${userId}`);
        const leaveEl = document.getElementById(`leave-${userId}`);
        
        if (availableEl) availableEl.textContent = `${counts[userId].availability} Available`;
        if (busyEl) busyEl.textContent = `${counts[userId].busy} Busy`;
        if (leaveEl) leaveEl.textContent = `${counts[userId].leave} Leave`;
    });
}

// Add team member info to calendar day cells
function addTeamMemberInfoToDay(info) {
    const dateStr = info.date.toISOString().split('T')[0];
    const dayEvents = allEvents.filter(event => 
        event.start.startsWith(dateStr) || event.start === dateStr
    );
    
    if (dayEvents.length > 0) {
        const teamInfo = document.createElement('div');
        teamInfo.className = 'team-day-info mt-1';
        
        // Group events by user
        const userEvents = {};
        dayEvents.forEach(event => {
            const userName = event.title.split(' - ')[0];
            if (!userEvents[userName]) {
                userEvents[userName] = [];
            }
            userEvents[userName].push(event);
        });
        
        // Create mini status indicators
        Object.keys(userEvents).slice(0, 3).forEach(userName => {
            const userEvent = userEvents[userName][0]; // Take first event for this user
            const type = userEvent.type;
            let color = '#6c757d';
            let icon = 'circle';
            
            if (type === 'availability') {
                color = '#28a745';
                icon = 'check-circle';
            } else if (type === 'busy') {
                color = '#dc3545';
                icon = 'times-circle';
            } else if (type === 'leave') {
                color = '#ffc107';
                icon = 'calendar-times';
            }
            
            const indicator = document.createElement('div');
            indicator.className = 'mini-indicator d-flex align-items-center mb-1';
            const iconEl = document.createElement('i');
            iconEl.className = `fas fa-${icon} me-1`;
            iconEl.style.cssText = `color: ${color}; font-size: 0.7em;`;
            const spanEl = document.createElement('span');
            spanEl.textContent = userName.split(' ')[0];
            spanEl.style.cssText = `font-size: 0.65em; color: ${color};`;
            indicator.appendChild(iconEl);
            indicator.appendChild(spanEl);
            teamInfo.appendChild(indicator);
        });
        
        if (Object.keys(userEvents).length > 3) {
            const moreIndicator = document.createElement('div');
            moreIndicator.className = 'mini-indicator';
            const smallEl = document.createElement('small');
            smallEl.textContent = `+${Object.keys(userEvents).length - 3} more`;
            smallEl.style.cssText = 'font-size: 0.6em; color: #6c757d;';
            moreIndicator.appendChild(smallEl);
            teamInfo.appendChild(moreIndicator);
        }
        
        info.el.appendChild(teamInfo);
    }
}

// Live team status functionality
function loadLiveTeamStatus() {
    // Only load if the live status container exists (on calendar page)
    if (!document.getElementById('liveTeamStatus')) return;
    
    // For non-admin users, create a simpler endpoint that doesn't expose detailed team info
    const endpoint = window.currentUser && window.currentUser.is_admin ? 
        '/api/team/status' : '/api/team/public-status';
    
    fetch(endpoint)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateLiveStatusDisplay(data.team_status || data.public_status || []);
                updateStatusTimestamp();
            } else {
                console.error('Error loading live status:', data.error);
                showOfflineStatus();
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showOfflineStatus();
        });
}

function updateLiveStatusDisplay(teamStatus) {
    const container = document.getElementById('liveTeamStatus');
    const onlineCountElement = document.getElementById('onlineCount');
    
    if (!container) return;
    
    const workingMembers = teamStatus.filter(member => member.is_working || member.is_clocked_in);
    
    // Update online count
    if (onlineCountElement) {
        onlineCountElement.textContent = workingMembers.length;
    }
    
    if (workingMembers.length === 0) {
        container.textContent = '';
        const noWorkDiv = document.createElement('div');
        noWorkDiv.className = 'text-muted d-flex align-items-center';
        const moonIcon = document.createElement('i');
        moonIcon.className = 'fas fa-moon me-2';
        const noWorkSpan = document.createElement('span');
        noWorkSpan.textContent = 'No one is currently working';
        noWorkDiv.appendChild(moonIcon);
        noWorkDiv.appendChild(noWorkSpan);
        container.appendChild(noWorkDiv);
        return;
    }
    
    let html = '';
    workingMembers.forEach(member => {
        const statusColor = getStatusColor(member.status_message);
        const durationText = getDurationText(member);
        
        html += `
            <div class="d-inline-flex align-items-center bg-dark rounded-pill px-3 py-2 me-2 mb-2" style="border: 1px solid var(--bs-${statusColor});">
                <div class="status-dot bg-${statusColor} rounded-circle me-2" style="width: 8px; height: 8px;"></div>
                <div class="d-flex flex-column">
                    <strong class="small">${member.username}</strong>
                    <small class="text-${statusColor}">${member.status_message || (member.is_clocked_in ? 'Working' : 'Offline')}</small>
                    ${member.current_task ? `<small class="text-muted">${member.current_task}</small>` : ''}
                    ${durationText ? `<small class="text-info">${durationText}</small>` : ''}
                </div>
            </div>
        `;
    });
    
    container.textContent = '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    while (tempDiv.firstChild) {
        container.appendChild(tempDiv.firstChild);
    }
}

function getStatusColor(status) {
    switch(status) {
        case 'Available': return 'success';
        case 'In Meeting': return 'warning';
        case 'Busy': return 'danger';
        case 'On Break': return 'info';
        case 'Away': return 'secondary';
        default: return 'success';
    }
}

function getDurationText(member) {
    if (!member.current_duration || member.current_duration <= 0) return '';
    
    const hours = Math.floor(member.current_duration / 60);
    const minutes = Math.floor(member.current_duration % 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

function updateStatusTimestamp() {
    const element = document.getElementById('statusLastUpdated');
    if (element) {
        const now = new Date();
        element.textContent = `Updated: ${now.toLocaleTimeString()}`;
    }
}

function showOfflineStatus() {
    const container = document.getElementById('liveTeamStatus');
    const onlineCountElement = document.getElementById('onlineCount');
    
    if (container) {
        container.textContent = '';
        const errorDiv = document.createElement('div');
        errorDiv.className = 'text-muted d-flex align-items-center';
        const errorIcon = document.createElement('i');
        errorIcon.className = 'fas fa-exclamation-triangle me-2';
        const errorSpan = document.createElement('span');
        errorSpan.textContent = 'Unable to load team status';
        errorDiv.appendChild(errorIcon);
        errorDiv.appendChild(errorSpan);
        container.appendChild(errorDiv);
    }
    
    if (onlineCountElement) {
        onlineCountElement.textContent = '0';
    }
}

// Add current user data to body for JavaScript access
document.addEventListener('DOMContentLoaded', function() {
    // This is now populated by the backend template in calendar.html
    if (typeof window.currentUser !== 'undefined') {
        document.body.dataset.currentUserId = window.currentUser.id;
        document.body.dataset.isAdmin = window.currentUser.is_admin;
        console.log('Current user loaded:', window.currentUser);
    }
    
    // Load and refresh live team status on calendar page
    if (document.getElementById('liveTeamStatus')) {
        loadLiveTeamStatus();
        setInterval(loadLiveTeamStatus, 30000); // Refresh every 30 seconds
    }
});
