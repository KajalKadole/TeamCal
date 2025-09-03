let calendar;
let currentEventType = null;
let selectedEvent = null;

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
        events: '/api/events',
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
            const url = userId === 'all' ? '/api/events' : `/api/events?user_id=${userId}`;
            calendar.removeAllEventSources();
            calendar.addEventSource(url);
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
    document.getElementById('startTime').value = '09:00';
    document.getElementById('endTime').value = '17:00';
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
            document.getElementById('startTime').value = '09:00';
            document.getElementById('endTime').value = '17:00';
            break;
            
        case 'busy':
            modalTitle.textContent = 'Mark as Busy';
            timeFields.style.display = 'block';
            titleField.style.display = 'block';
            leaveTypeField.style.display = 'none';
            descriptionField.style.display = 'block';
            document.getElementById('eventTitle').value = 'Meeting';
            document.getElementById('startTime').value = '10:00';
            document.getElementById('endTime').value = '11:00';
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
            eventData.start_time = document.getElementById('startTime').value;
            eventData.end_time = document.getElementById('endTime').value;
            break;
            
        case 'busy':
            eventData.start_time = document.getElementById('startTime').value;
            eventData.end_time = document.getElementById('endTime').value;
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
    
    if (currentEventType === 'busy' && eventData.start_time >= eventData.end_time) {
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
            calendar.refetchEvents();
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
    
    // Show delete button only for current user's events or if admin
    const deleteBtn = document.getElementById('deleteEventBtn');
    const currentUserId = parseInt(document.body.dataset.currentUserId) || 0;
    const isAdmin = document.body.dataset.isAdmin === 'true';
    
    if (event.extendedProps.user_id === currentUserId || isAdmin) {
        deleteBtn.style.display = 'block';
    } else {
        deleteBtn.style.display = 'none';
    }
    
    html += '</div>';
    detailsContainer.innerHTML = html;
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
            calendar.refetchEvents();
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

// Utility functions
function showAlert(message, type) {
    const alertContainer = document.querySelector('.container');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show mt-3`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
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

// Add current user data to body for JavaScript access
document.addEventListener('DOMContentLoaded', function() {
    // This would be populated by the backend template
    // For now, we'll handle it gracefully if not present
    if (typeof window.currentUser !== 'undefined') {
        document.body.dataset.currentUserId = window.currentUser.id;
        document.body.dataset.isAdmin = window.currentUser.is_admin;
    }
});
