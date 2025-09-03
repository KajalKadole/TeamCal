from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField, TimeField, DateField, TextAreaField, SelectField, BooleanField
from wtforms.validators import DataRequired, Email, EqualTo, Length, ValidationError
from models import User

class LoginForm(FlaskForm):
    email = StringField('Email', validators=[DataRequired(), Email()])
    password = PasswordField('Password', validators=[DataRequired()])
    submit = SubmitField('Sign In')

class RegistrationForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired(), Length(min=4, max=20)])
    email = StringField('Email', validators=[DataRequired(), Email()])
    password = PasswordField('Password', validators=[DataRequired(), Length(min=6)])
    password2 = PasswordField('Repeat Password', validators=[DataRequired(), EqualTo('password')])
    submit = SubmitField('Register')
    
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
    default_start_time = TimeField('Default Start Time')
    default_end_time = TimeField('Default End Time')
    submit = SubmitField('Update Profile')

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
