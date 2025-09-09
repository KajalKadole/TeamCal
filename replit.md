# Overview

Ziqsy Team Calendar is a Flask-based web application designed to streamline team scheduling and availability management. The system allows all employees to set their availability, mark busy periods, request leave days, and view a consolidated team calendar of all members. Built with a focus on simplicity and efficiency, it provides an intuitive interface for managing team schedules and coordinating work assignments with universal access to calendar and timeline views.

# Recent Changes

## September 9, 2025 - Universal Team Calendar Access
- **Feature**: Calendar and timeline views are now accessible to all team members, not just administrators
- **Changes Made**:
  - Removed admin-only restrictions from user and department filter dropdowns
  - Updated API endpoints (`/api/events` and `/api/gantt-data`) to allow all users to view team data
  - Changed calendar title from "Master Calendar" (admin) / "My Calendar" (user) to "Team Calendar" for everyone
  - Enhanced drag-and-drop availability selection with intuitive click-and-drag functionality
- **Impact**: All team members can now view, filter, and interact with the complete team schedule
- **User Experience**: Click single days or drag across multiple days to easily add availability

## September 6, 2025 - Fixed JavaScript Syntax Errors
- **Issue**: Console errors showing "Uncaught SyntaxError: Unexpected token ')'" preventing clock in functionality
- **Root Cause**: Boolean values in Jinja2 templates were not being properly converted to JavaScript
- **Files Fixed**:
  - `templates/timesheet.html`: Changed `{{ 'true' if current_user.is_admin else 'false' }}` to `{{ current_user.is_admin|tojson|safe }}`
  - `templates/calendar.html`: Applied same fix for consistent boolean handling
- **Solution**: Used Jinja2's `tojson` filter with `safe` to properly serialize Python boolean values to JavaScript
- **Impact**: Clock in/out functionality now works correctly, no more JavaScript syntax errors

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Template Engine**: Jinja2 templates with Bootstrap 5 dark theme for responsive UI
- **JavaScript Libraries**: FullCalendar for interactive calendar functionality, providing month/week/day views
- **Styling**: Custom CSS combined with Bootstrap and Font Awesome icons for a professional appearance
- **Interactive Components**: Modal dialogs for event creation/editing, real-time calendar filtering for admin users

## Backend Architecture
- **Framework**: Flask with modular structure separating concerns across multiple files
- **Database ORM**: SQLAlchemy with declarative base model for database operations
- **Authentication**: Flask-Login for session management with role-based access (admin/employee)
- **Form Handling**: WTForms with built-in validation and CSRF protection
- **Security**: Password hashing using Werkzeug, secure session management, and proxy support

## Data Model Design
- **User Management**: User model with authentication, role permissions, and default working hours
- **Availability System**: Three-tier scheduling system with AvailabilitySlot, BusySlot, and LeaveDay models
- **Relationships**: Foreign key relationships with cascade delete for data integrity
- **Time Management**: Separate date and time fields for flexible scheduling options

## Application Structure
- **Entry Point**: main.py serves as application runner
- **Core Configuration**: app.py handles Flask app initialization and extensions
- **Route Management**: routes.py contains all HTTP endpoints and business logic
- **Data Models**: models.py defines database schema and relationships
- **Form Validation**: forms.py manages user input validation and rendering

# External Dependencies

## Core Framework Dependencies
- **Flask**: Web application framework with SQLAlchemy integration
- **Flask-Login**: User session management and authentication
- **WTForms/Flask-WTF**: Form handling with validation and CSRF protection
- **Werkzeug**: WSGI utilities including password hashing and proxy middleware

## Frontend Libraries
- **Bootstrap 5**: CSS framework with dark theme variant from cdn.replit.com
- **FullCalendar 6.1.8**: JavaScript calendar component for event visualization
- **Font Awesome 6.4.0**: Icon library for UI enhancement

## Database Configuration
- **SQLAlchemy**: ORM for database operations with connection pooling
- **Database**: Configurable via DATABASE_URL environment variable (defaults to SQLite)
- **Connection Management**: Pool recycling and pre-ping enabled for reliability

## Environment Configuration
- **Session Security**: SESSION_SECRET environment variable for secure sessions
- **Database URL**: Flexible database connection string support
- **Development Mode**: Debug mode enabled with hot reloading on localhost:5000