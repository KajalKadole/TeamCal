/**
 * Leave Requests Management JavaScript
 * File: static/js/leave_requests.js
 */

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Set up date inputs
    const today = new Date().toISOString().split('T')[0];
    const leaveStartDate = document.getElementById('leaveStartDate');
    const leaveEndDate = document.getElementById('leaveEndDate');
    
    if (leaveStartDate && leaveEndDate) {
        leaveStartDate.min = today;
        leaveEndDate.min = today;
        
        leaveStartDate.addEventListener('change', function() {
            leaveEndDate.min = this.value;
            if (leaveEndDate.value < this.value) {
                leaveEndDate.value = this.value;
            }
            calculateLeaveDays();
        });
        
        leaveEndDate.addEventListener('change', calculateLeaveDays);
    }
    
    // Load initial data
    loadLeaveRequests('pending');
    updateStatistics();
});

// Calculate leave days
function calculateLeaveDays() {
    const startDate = document.getElementById('leaveStartDate').value;
    const endDate = document.getElementById('leaveEndDate').value;
    
    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (end >= start) {
            const diffTime = Math.abs(end - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            document.getElementById('leaveTotalDays').textContent = `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
        } else {
            document.getElementById('leaveTotalDays').textContent = '0 days';
        }
    }
}

// Show leave request modal
function showLeaveRequestModal() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('leaveStartDate').value = today;
    document.getElementById('leaveEndDate').value = today;
    calculateLeaveDays();
    
    const modal = new bootstrap.Modal(document.getElementById('leaveRequestModal'));
    modal.show();
}

// Submit leave request
async function submitLeaveRequest() {
    const startDate = document.getElementById('leaveStartDate').value;
    const endDate = document.getElementById('leaveEndDate').value;
    const leaveType = document.getElementById('leaveRequestType').value;
    const reason = document.getElementById('leaveReason').value;
    const contact = document.getElementById('leaveContact').value;
    
    // Validation
    if (!startDate || !endDate || !leaveType || !reason) {
        showAlert('Please fill in all required fields', 'danger');
        return;
    }
    
    if (new Date(endDate) < new Date(startDate)) {
        showAlert('End date must be after start date', 'danger');
        return;
    }
    
    try {
        const response = await fetch('/api/leave-requests/submit', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                start_date: startDate,
                end_date: endDate,
                leave_type: leaveType,
                reason: reason,
                contact: contact
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert(`Leave request submitted successfully! Total Days: ${data.total_days}<br>You will receive an email notification once reviewed.`, 'success');
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('leaveRequestModal'));
            modal.hide();
            
            // Reset form
            document.getElementById('leaveRequestForm').reset();
            
            // Reload lists
            await loadLeaveRequests('pending');
            await updateStatistics();
        } else {
            showAlert('Error: ' + data.error, 'danger');
        }
    } catch (error) {
        console.error('Error submitting leave request:', error);
        showAlert('Failed to submit leave request. Please try again.', 'danger');
    }
}

// Load leave requests by status
async function loadLeaveRequests(status) {
    const listId = status + 'RequestsList';
    const listElement = document.getElementById(listId);
    
    if (!listElement) return;
    
    try {
        const response = await fetch(`/api/leave-requests?status=${status}`);
        const data = await response.json();
        
        if (data.success) {
            // Update badges
            const badgeId = status + 'Badge';
            const cardId = status + 'CountCard';
            document.getElementById(badgeId).textContent = data.requests.length;
            document.getElementById(cardId).textContent = data.requests.length;
            
            if (data.requests.length === 0) {
                listElement.innerHTML = `
                    <div class="text-center py-5">
                        <i class="fas fa-inbox fa-4x text-muted mb-3"></i>
                        <p class="text-muted">No ${status} leave requests</p>
                    </div>
                `;
                return;
            }
            
            // Build requests list
            let html = '<div class="table-responsive"><table class="table table-hover">';
            html += '<thead><tr>';
            html += '<th>Employee</th><th>Department</th><th>Leave Type</th>';
            html += '<th>Start Date</th><th>End Date</th><th>Days</th>';
            html += '<th>Status</th><th>Actions</th>';
            html += '</tr></thead><tbody>';
            
            data.requests.forEach(req => {
                const statusBadges = getStatusBadges(req);
                const actionButtons = getActionButtons(req, status);
                
                html += `
                    <tr onclick="showLeaveDetails(${req.id})" style="cursor: pointer;">
                        <td>
                            <strong>${req.username}</strong><br>
                            <small class="text-muted">${req.email}</small>
                        </td>
                        <td>${req.department}</td>
                        <td><span class="badge bg-info">${req.leave_type}</span></td>
                        <td>${formatDate(req.start_date)}</td>
                        <td>${formatDate(req.end_date)}</td>
                        <td><strong>${req.total_days}</strong></td>
                        <td>${statusBadges}</td>
                        <td onclick="event.stopPropagation()">${actionButtons}</td>
                    </tr>
                `;
            });
            
            html += '</tbody></table></div>';
            listElement.innerHTML = html;
        }
    } catch (error) {
        console.error('Error loading leave requests:', error);
        listElement.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Failed to load leave requests. Please refresh the page.
            </div>
        `;
    }
}

// Load my leave requests
async function loadMyLeaveRequests() {
    const listElement = document.getElementById('myRequestsList');
    
    try {
        const response = await fetch('/api/leave-requests/my-requests');
        const data = await response.json();
        
        if (data.success) {
            if (data.requests.length === 0) {
                listElement.innerHTML = `
                    <div class="text-center py-5">
                        <i class="fas fa-calendar-times fa-4x text-muted mb-3"></i>
                        <p class="text-muted">You haven't submitted any leave requests yet</p>
                        <button class="btn btn-primary mt-3" onclick="showLeaveRequestModal()">
                            <i class="fas fa-plus me-2"></i>Request Leave
                        </button>
                    </div>
                `;
                return;
            }
            
            // Build requests cards
            let html = '<div class="row">';
            
            data.requests.forEach(req => {
                const statusClass = req.status === 'approved' ? 'success' : 
                                   req.status === 'rejected' ? 'danger' : 'warning';
                const statusIcon = req.status === 'approved' ? 'check-circle' : 
                                  req.status === 'rejected' ? 'times-circle' : 'clock';
                
                html += `
                    <div class="col-md-6 mb-3">
                        <div class="card border-${statusClass}">
                            <div class="card-header bg-${statusClass} text-white">
                                <div class="d-flex justify-content-between align-items-center">
                                    <span><i class="fas fa-${statusIcon} me-2"></i>${req.leave_type}</span>
                                    <span class="badge bg-light text-dark">${req.total_days} days</span>
                                </div>
                            </div>
                            <div class="card-body">
                                <div class="mb-2">
                                    <strong>Period:</strong> ${formatDate(req.start_date)} to ${formatDate(req.end_date)}
                                </div>
                                <div class="mb-2">
                                    <strong>Reason:</strong> ${req.reason}
                                </div>
                                <div class="mb-2">
                                    <strong>Submitted:</strong> ${formatDateTime(req.submitted_at)}
                                </div>
                                <hr>
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        ${getStatusBadges(req)}
                                    </div>
                                    ${req.can_cancel ? `
                                        <button class="btn btn-sm btn-outline-danger" onclick="cancelLeaveRequest(${req.id})">
                                            <i class="fas fa-times me-1"></i>Cancel
                                        </button>
                                    ` : ''}
                                </div>
                                ${req.manager_comments ? `
                                    <div class="alert alert-info mt-2 mb-0 py-2">
                                        <small><strong>Manager:</strong> ${req.manager_comments}</small>
                                    </div>
                                ` : ''}
                                ${req.hr_comments ? `
                                    <div class="alert alert-info mt-2 mb-0 py-2">
                                        <small><strong>HR:</strong> ${req.hr_comments}</small>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            listElement.innerHTML = html;
        }
    } catch (error) {
        console.error('Error loading my requests:', error);
    }
}

// Get status badges HTML - Updated for LeaveDay model
function getStatusBadges(req) {
    let badges = '';
    
    if (req.status === 'approved') {
        badges = '<span class="badge bg-success"><i class="fas fa-check me-1"></i>Approved</span>';
        if (req.hr_status === 'approved') {
            badges += ' <span class="badge bg-success"><i class="fas fa-user-check me-1"></i>HR Approved</span>';
        }
    } else if (req.status === 'rejected') {
        badges = '<span class="badge bg-danger"><i class="fas fa-times me-1"></i>Rejected</span>';
        if (req.hr_status === 'rejected') {
            badges += ' <span class="badge bg-danger"><i class="fas fa-user-times me-1"></i>HR Rejected</span>';
        }
    } else {
        badges = '<span class="badge bg-warning"><i class="fas fa-clock me-1"></i>Pending Approval</span>';
    }
    
    return badges;
}

// Get action buttons
function getActionButtons(req, status) {
    if (status !== 'pending') return '';
    
    return `
        <div class="btn-group btn-group-sm">
            <button class="btn btn-success" onclick="event.stopPropagation(); approveLeaveRequest(${req.id})">
                <i class="fas fa-check"></i>
            </button>
            <button class="btn btn-danger" onclick="event.stopPropagation(); rejectLeaveRequest(${req.id})">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
}

// Approve leave request
async function approveLeaveRequest(requestId) {
    const comments = prompt('Enter approval comments (optional):');
    
    if (comments === null) return;
    
    try {
        const response = await fetch(`/api/leave-requests/${requestId}/approve`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ comments: comments })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Leave request approved successfully!', 'success');
            await loadLeaveRequests('pending');
            await updateStatistics();
        } else {
            showAlert('Error: ' + data.error, 'danger');
        }
    } catch (error) {
        console.error('Error approving leave:', error);
        showAlert('Failed to approve leave request', 'danger');
    }
}

// Reject leave request
async function rejectLeaveRequest(requestId) {
    const comments = prompt('Enter rejection reason (required):');
    
    if (!comments || comments.trim() === '') {
        showAlert('Rejection reason is required', 'warning');
        return;
    }
    
    if (!confirm('Are you sure you want to reject this leave request?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/leave-requests/${requestId}/reject`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ comments: comments })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Leave request rejected', 'info');
            await loadLeaveRequests('pending');
            await updateStatistics();
        } else {
            showAlert('Error: ' + data.error, 'danger');
        }
    } catch (error) {
        console.error('Error rejecting leave:', error);
        showAlert('Failed to reject leave request', 'danger');
    }
}

// Cancel leave request
async function cancelLeaveRequest(requestId) {
    if (!confirm('Are you sure you want to cancel this leave request?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/leave-requests/${requestId}/cancel`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Leave request cancelled', 'info');
            await loadMyLeaveRequests();
        } else {
            showAlert('Error: ' + data.error, 'danger');
        }
    } catch (error) {
        console.error('Error cancelling leave:', error);
        showAlert('Failed to cancel leave request', 'danger');
    }
}

// Update statistics
async function updateStatistics() {
    try {
        const statuses = ['pending', 'approved', 'rejected'];
        let monthlyCount = 0;
        
        for (const status of statuses) {
            const response = await fetch(`/api/leave-requests?status=${status}`);
            const data = await response.json();
            
            if (data.success) {
                document.getElementById(status + 'CountCard').textContent = data.requests.length;
                monthlyCount += data.requests.length;
            }
        }
        
        document.getElementById('monthlyCountCard').textContent = monthlyCount;
    } catch (error) {
        console.error('Error updating statistics:', error);
    }
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
    });
}

// Format datetime
function formatDateTime(datetimeString) {
    const date = new Date(datetimeString);
    return date.toLocaleString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Show alert
function showAlert(message, type = 'info') {
    const alertHtml = `
        <div class="alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3" 
             role="alert" style="z-index: 9999; min-width: 300px;">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', alertHtml);
    
    setTimeout(() => {
        const alerts = document.querySelectorAll('.alert');
        alerts.forEach(alert => {
            if (alert.parentElement) {
                alert.remove();
            }
        });
    }, 5000);
}

// Show leave details modal
async function showLeaveDetails(requestId) {
    try {
        // Fetch all requests to find the specific one
        const response = await fetch('/api/leave-requests?status=all');
        const data = await response.json();
        
        if (data.success) {
            const request = data.requests.find(r => r.id === requestId);
            if (!request) {
                showAlert('Leave request not found', 'danger');
                return;
            }
            
            // Populate modal with details
            const detailsBody = document.getElementById('leaveDetailsBody');
            detailsBody.innerHTML = `
                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label class="form-label text-muted">Employee</label>
                        <div class="fw-bold">${request.username}</div>
                        <small class="text-muted">${request.email}</small>
                    </div>
                    <div class="col-md-6 mb-3">
                        <label class="form-label text-muted">Department</label>
                        <div class="fw-bold">${request.department}</div>
                    </div>
                    <div class="col-md-6 mb-3">
                        <label class="form-label text-muted">Leave Type</label>
                        <div><span class="badge bg-info">${request.leave_type}</span></div>
                    </div>
                    <div class="col-md-6 mb-3">
                        <label class="form-label text-muted">Status</label>
                        <div>${getStatusBadges(request)}</div>
                    </div>
                    <div class="col-md-4 mb-3">
                        <label class="form-label text-muted">Start Date</label>
                        <div class="fw-bold">${formatDate(request.start_date)}</div>
                    </div>
                    <div class="col-md-4 mb-3">
                        <label class="form-label text-muted">End Date</label>
                        <div class="fw-bold">${formatDate(request.end_date)}</div>
                    </div>
                    <div class="col-md-4 mb-3">
                        <label class="form-label text-muted">Total Days</label>
                        <div class="fw-bold">${request.total_days} days</div>
                    </div>
                    <div class="col-12 mb-3">
                        <label class="form-label text-muted">Reason</label>
                        <div class="border rounded p-3 bg-light">${request.reason}</div>
                    </div>
                    ${request.manager_comments ? `
                        <div class="col-12 mb-3">
                            <label class="form-label text-muted">Manager Comments</label>
                            <div class="alert alert-info mb-0">${request.manager_comments}</div>
                        </div>
                    ` : ''}
                    ${request.hr_comments ? `
                        <div class="col-12 mb-3">
                            <label class="form-label text-muted">HR Comments</label>
                            <div class="alert alert-info mb-0">${request.hr_comments}</div>
                        </div>
                    ` : ''}
                    <div class="col-12">
                        <small class="text-muted">Submitted on ${formatDateTime(request.submitted_at)}</small>
                    </div>
                </div>
            `;
            
            // Populate footer with action buttons
            const detailsFooter = document.getElementById('leaveDetailsFooter');
            if (request.status === 'pending') {
                detailsFooter.innerHTML = `
                    <button type="button" class="btn btn-success" onclick="approveLeaveRequest(${request.id}); bootstrap.Modal.getInstance(document.getElementById('leaveDetailsModal')).hide();">
                        <i class="fas fa-check me-2"></i>Approve
                    </button>
                    <button type="button" class="btn btn-danger" onclick="rejectLeaveRequest(${request.id}); bootstrap.Modal.getInstance(document.getElementById('leaveDetailsModal')).hide();">
                        <i class="fas fa-times me-2"></i>Reject
                    </button>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                `;
            } else {
                detailsFooter.innerHTML = `
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                `;
            }
            
            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('leaveDetailsModal'));
            modal.show();
        }
    } catch (error) {
        console.error('Error loading leave details:', error);
        showAlert('Failed to load leave details', 'danger');
    }
}