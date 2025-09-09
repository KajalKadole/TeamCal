// Analytics Dashboard JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Initialize charts and load data
    initializeAnalytics();
    
    // Set up filters
    document.getElementById('timeRangeFilter').addEventListener('change', function() {
        loadAnalyticsData();
    });
});

let charts = {
    workHoursTrend: null,
    statusDistribution: null,
    userProductivity: null
};

function initializeAnalytics() {
    console.log('Initializing analytics dashboard...'); // Debug log
    
    // Create chart instances
    createCharts();
    
    // Load initial data
    loadAnalyticsData();
    
    // Refresh data every 5 minutes
    setInterval(loadAnalyticsData, 300000);
}

function createCharts() {
    // Work Hours Trend Chart
    const trendCtx = document.getElementById('workHoursTrendChart').getContext('2d');
    charts.workHoursTrend = new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Daily Hours',
                data: [],
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'rgba(54, 162, 235, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Hours'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Date'
                    }
                }
            }
        }
    });

    // Status Distribution Chart
    const statusCtx = document.getElementById('statusDistributionChart').getContext('2d');
    charts.statusDistribution = new Chart(statusCtx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    '#28a745', // Available - Green
                    '#ffc107', // In Meeting - Yellow
                    '#dc3545', // Busy - Red
                    '#17a2b8', // On Break - Blue
                    '#6c757d', // Away - Gray
                    '#343a40'  // Offline - Dark
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });

    // User Productivity Chart
    const productivityCtx = document.getElementById('userProductivityChart').getContext('2d');
    charts.userProductivity = new Chart(productivityCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Total Hours',
                    data: [],
                    backgroundColor: 'rgba(54, 162, 235, 0.8)',
                    yAxisID: 'y'
                },
                {
                    label: 'Sessions',
                    data: [],
                    backgroundColor: 'rgba(255, 99, 132, 0.8)',
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Hours'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Sessions'
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                }
            }
        }
    });
}

function loadAnalyticsData() {
    console.log('Loading analytics data...'); // Debug log
    showLoading();
    
    // Get selected time range
    const timeRangeFilter = document.getElementById('timeRangeFilter');
    const days = timeRangeFilter ? timeRangeFilter.value : '30';
    console.log('Loading analytics for', days, 'days'); // Debug log
    
    // Load all analytics data with time range
    Promise.all([
        loadOverviewData(days),
        loadWorkHoursTrend(days),
        loadUserProductivity(days),
        loadStatusDistribution(days)
    ]).then(() => {
        console.log('All analytics data loaded successfully'); // Debug log
        hideLoading();
    }).catch(error => {
        console.error('Analytics loading failed:', error.message || error);
        hideLoading();
        showError('Failed to load analytics data');
    });
}

function loadOverviewData(days) {
    return fetch(`/api/analytics/overview?days=${days}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateOverviewMetrics(data.data);
            } else {
                throw new Error(data.error);
            }
        });
}

function loadWorkHoursTrend(days) {
    console.log('Loading work hours trend for', days, 'days...'); // Debug log
    return fetch(`/api/analytics/work-hours-trend?days=${days}`)
        .then(response => response.json())
        .then(data => {
            console.log('Work hours trend response:', data); // Debug log
            if (data.success) {
                updateWorkHoursTrendChart(data.data);
            } else {
                console.error('Work hours trend API error:', data.error);
                throw new Error(data.error);
            }
        })
        .catch(error => {
            console.error('Work hours trend fetch failed:', error.message || error);
            throw error;
        });
}

function loadUserProductivity(days) {
    return fetch(`/api/analytics/user-productivity?days=${days}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateUserProductivityChart(data.data);
                updateTopPerformersTable(data.data);
                updateProductivityInsights(data.data);
            } else {
                console.error('Failed to load user productivity data:', data.error);
                // Update table with error state
                const tbody = document.querySelector('#topPerformersTable tbody');
                if (tbody) {
                    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Failed to load data</td></tr>';
                }
                throw new Error(data.error);
            }
        })
        .catch(error => {
            console.error('Error loading user productivity data:', error);
            // Update table with error state
            const tbody = document.querySelector('#topPerformersTable tbody');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Error loading data</td></tr>';
            }
            throw error;
        });
}

function loadStatusDistribution(days) {
    console.log('Loading status distribution for', days, 'days...'); // Debug log
    return fetch(`/api/analytics/status-distribution?days=${days}`)
        .then(response => response.json())
        .then(data => {
            console.log('Status distribution response:', data); // Debug log
            if (data.success) {
                updateStatusDistributionChart(data.data);
            } else {
                console.error('Status distribution API error:', data.error);
                throw new Error(data.error);
            }
        })
        .catch(error => {
            console.error('Status distribution fetch failed:', error.message || error);
            throw error;
        });
}

function updateOverviewMetrics(data) {
    document.getElementById('activeUsersMetric').textContent = data.active_users;
    document.getElementById('totalHoursMetric').textContent = data.total_hours + 'h';
    document.getElementById('weekHoursMetric').textContent = data.week_hours + 'h';
}

function updateWorkHoursTrendChart(data) {
    const labels = data.map(item => {
        const date = new Date(item.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const hours = data.map(item => item.hours);
    
    charts.workHoursTrend.data.labels = labels;
    charts.workHoursTrend.data.datasets[0].data = hours;
    charts.workHoursTrend.update();
}

function updateStatusDistributionChart(data) {
    const labels = data.map(item => item.status);
    const counts = data.map(item => item.count);
    
    charts.statusDistribution.data.labels = labels;
    charts.statusDistribution.data.datasets[0].data = counts;
    charts.statusDistribution.update();
}

function updateUserProductivityChart(data) {
    // Sort by total hours descending
    data.sort((a, b) => b.total_hours - a.total_hours);
    
    const labels = data.map(item => item.username);
    const hours = data.map(item => item.total_hours);
    const sessions = data.map(item => item.total_sessions);
    
    charts.userProductivity.data.labels = labels;
    charts.userProductivity.data.datasets[0].data = hours;
    charts.userProductivity.data.datasets[1].data = sessions;
    charts.userProductivity.update();
}

function updateTopPerformersTable(data) {
    // Sort by total hours descending
    data.sort((a, b) => b.total_hours - a.total_hours);
    
    const tbody = document.querySelector('#topPerformersTable tbody');
    tbody.innerHTML = '';
    
    data.slice(0, 5).forEach((performer, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div class="d-flex align-items-center">
                    <span class="badge bg-primary me-2">${index + 1}</span>
                    ${performer.username}
                </div>
            </td>
            <td><strong>${performer.total_hours}h</strong></td>
            <td>${performer.total_sessions}</td>
            <td>${performer.avg_session_hours}h</td>
        `;
        tbody.appendChild(row);
    });
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No data available</td></tr>';
    }
}

function updateProductivityInsights(data) {
    const container = document.getElementById('productivityInsights');
    
    if (data.length === 0) {
        container.innerHTML = '<div class="text-muted text-center">No productivity data available</div>';
        return;
    }
    
    // Calculate insights
    const totalHours = data.reduce((sum, user) => sum + user.total_hours, 0);
    const avgHours = totalHours / data.length;
    const topPerformer = data.reduce((top, user) => user.total_hours > top.total_hours ? user : top);
    const mostConsistent = data.reduce((consistent, user) => 
        user.avg_session_hours > consistent.avg_session_hours ? user : consistent
    );
    
    container.innerHTML = `
        <div class="row g-3">
            <div class="col-12">
                <div class="alert alert-info border-0">
                    <h6><i class="fas fa-trophy me-2"></i>Top Performer</h6>
                    <p class="mb-0"><strong>${topPerformer.username}</strong> leads with ${topPerformer.total_hours} hours worked</p>
                </div>
            </div>
            <div class="col-12">
                <div class="alert alert-success border-0">
                    <h6><i class="fas fa-chart-line me-2"></i>Team Average</h6>
                    <p class="mb-0">${avgHours.toFixed(1)} hours per person this month</p>
                </div>
            </div>
            <div class="col-12">
                <div class="alert alert-warning border-0">
                    <h6><i class="fas fa-clock me-2"></i>Most Consistent</h6>
                    <p class="mb-0"><strong>${mostConsistent.username}</strong> has the highest average session time (${mostConsistent.avg_session_hours}h)</p>
                </div>
            </div>
        </div>
    `;
}

function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('d-none');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('d-none');
}

function showError(message) {
    // Create a simple error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x';
    errorDiv.style.zIndex = '10000';
    errorDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(errorDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 5000);
}

function exportAnalyticsData() {
    showLoading();
    
    // Get selected time range
    const timeRangeFilter = document.getElementById('timeRangeFilter');
    const days = timeRangeFilter ? timeRangeFilter.value : '30';
    
    // Create a comprehensive data export
    Promise.all([
        fetch(`/api/analytics/overview?days=${days}`).then(r => r.json()),
        fetch(`/api/analytics/work-hours-trend?days=${days}`).then(r => r.json()),
        fetch(`/api/analytics/user-productivity?days=${days}`).then(r => r.json()),
        fetch(`/api/analytics/status-distribution?days=${days}`).then(r => r.json())
    ]).then(([overview, trend, productivity, status]) => {
        const exportData = {
            generated_at: new Date().toISOString(),
            overview: overview.success ? overview.data : {},
            work_hours_trend: trend.success ? trend.data : [],
            user_productivity: productivity.success ? productivity.data : [],
            status_distribution: status.success ? status.data : []
        };
        
        // Create and download JSON file
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `team-analytics-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        hideLoading();
    }).catch(error => {
        console.error('Export failed:', error);
        showError('Failed to export analytics data');
        hideLoading();
    });
}