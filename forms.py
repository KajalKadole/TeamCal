from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField, TimeField, DateField, TextAreaField, SelectField, BooleanField
from wtforms.validators import DataRequired, Email, EqualTo, Length, ValidationError
from models import User, Department

class LoginForm(FlaskForm):
    email = StringField('Email', validators=[DataRequired(), Email()])
    password = PasswordField('Password', validators=[DataRequired()])
    submit = SubmitField('Sign In')

class RegistrationForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired(), Length(min=4, max=20)])
    email = StringField('Email', validators=[DataRequired(), Email()])
    department_id = SelectField('Department', coerce=int, validators=[DataRequired()])
    password = PasswordField('Password', validators=[DataRequired(), Length(min=6)])
    password2 = PasswordField('Repeat Password', validators=[DataRequired(), EqualTo('password')])
    submit = SubmitField('Register')
    
    def __init__(self, *args, **kwargs):
        super(RegistrationForm, self).__init__(*args, **kwargs)
        self.department_id.choices = [(dept.id, dept.name) for dept in Department.query.order_by(Department.name).all()]
        if not self.department_id.choices:
            self.department_id.choices = [(0, 'No departments available')]
    
    def validate_username(self, username):
        user = User.query.filter_by(username=username.data).first()
        if user is not None:
            raise ValidationError('Please use a different username.')
    
    def validate_email(self, email):
        user = User.query.filter_by(email=email.data).first()
        if user is not None:
            raise ValidationError('Please use a different email address.')

class AvailabilityForm(FlaskForm):
    date = DateField('Date', validators=[DataRequired()])
    start_time = TimeField('Start Time', validators=[DataRequired()])
    end_time = TimeField('End Time', validators=[DataRequired()])
    recurring = BooleanField('Recurring Weekly')
    submit = SubmitField('Add Availability')

class BusySlotForm(FlaskForm):
    date = DateField('Date', validators=[DataRequired()])
    start_time = TimeField('Start Time', validators=[DataRequired()])
    end_time = TimeField('End Time', validators=[DataRequired()])
    title = StringField('Title', default='Busy')
    description = TextAreaField('Description')
    submit = SubmitField('Mark as Busy')

class LeaveDayForm(FlaskForm):
    date = DateField('Date', validators=[DataRequired()])
    leave_type = SelectField('Leave Type', choices=[
        ('Leave', 'General Leave'),
        ('Vacation', 'Vacation'),
        ('Sick', 'Sick Leave'),
        ('Personal', 'Personal Day'),
        ('Holiday', 'Holiday')
    ], default='Leave')
    notes = TextAreaField('Notes')
    submit = SubmitField('Request Leave')

class ProfileForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired(), Length(min=4, max=20)])
    email = StringField('Email', validators=[DataRequired(), Email()])
    department_id = SelectField('Department', coerce=int, validators=[DataRequired()])
    default_start_time = TimeField('Default Start Time')
    default_end_time = TimeField('Default End Time')
    timezone = SelectField('Timezone', choices=[
        ('UTC', 'UTC (Coordinated Universal Time)'),
        ('Asia/Kolkata', 'India Standard Time (IST)'),
        ('Europe/Berlin', 'Central European Time (CET)'),
        ('Europe/London', 'Greenwich Mean Time (GMT)')
    ], default='UTC')
    submit = SubmitField('Update Profile')
    
    def __init__(self, *args, **kwargs):
        super(ProfileForm, self).__init__(*args, **kwargs)
        self.department_id.choices = [(dept.id, dept.name) for dept in Department.query.order_by(Department.name).all()]

class DepartmentForm(FlaskForm):
    name = StringField('Department Name', validators=[DataRequired(), Length(min=2, max=100)])
    description = TextAreaField('Description')
    submit = SubmitField('Save Department')
    
    def validate_name(self, name):
        department = Department.query.filter_by(name=name.data).first()
        if department is not None:
            raise ValidationError('A department with this name already exists.')

class AddEmployeeForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired(), Length(min=4, max=20)])
    email = StringField('Email', validators=[DataRequired(), Email()])
    password = PasswordField('Temporary Password', validators=[DataRequired(), Length(min=6)])
    submit = SubmitField('Add Employee')
    
    def validate_username(self, username):
        user = User.query.filter_by(username=username.data).first()
        if user is not None:
            raise ValidationError('Username already exists.')
    
    def validate_email(self, email):
        user = User.query.filter_by(email=email.data).first()
        if user is not None:
            raise ValidationError('Email already registered.')
