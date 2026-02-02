---
name: build-website
description: Scaffold a Rails 8 app with Hotwire, authentication, and DHH conventions
argument-hint: "[app-name]"
---

# Build Website - Rails 8 App Scaffolding

Scaffold a complete Rails 8 application with Hotwire, custom authentication, and DHH/37signals conventions.

## App Name

<app_name>$ARGUMENTS</app_name>

**If no app name provided, ask:** "What would you like to name your app? (e.g., my-app, blog, saas-starter)"

## Prerequisites Check

Before starting, verify:
```bash
rails --version  # Should be Rails 8+
psql --version   # PostgreSQL installed
node --version   # Node.js for assets
```

If any are missing, inform the user and stop.

## Step 1: Generate Rails Application

```bash
rails new $APP_NAME \
  --database=postgresql \
  --css=tailwind \
  --skip-jbuilder \
  --skip-test \
  --skip-system-test
```

Change into the new directory for all subsequent commands.

## Step 2: Update Gemfile

Add the DHH/37signals stack. Edit the Gemfile to include:

```ruby
# Solid stack - database-backed services (no Redis)
gem "solid_queue"
gem "solid_cache"
gem "solid_cable"
gem "mission_control-jobs"

# Deployment
gem "kamal"
gem "thruster"

# Utilities
gem "geared_pagination"
```

Then run:
```bash
bundle install
```

## Step 3: Create Authentication System

Create custom passwordless magic link authentication (~150 lines total).

### 3.1 Generate Migrations

Create migration for users:
```bash
bin/rails generate migration CreateUsers email:string:uniq name:string
```

Create migration for sessions:
```bash
bin/rails generate migration CreateSessions user:references token:string:uniq
```

Create migration for magic links:
```bash
bin/rails generate migration CreateMagicLinks user:references code:string expires_at:datetime
```

Run migrations:
```bash
bin/rails db:create db:migrate
```

### 3.2 Create Models

**app/models/user.rb:**
```ruby
class User < ApplicationRecord
  has_many :sessions, dependent: :destroy
  has_many :magic_links, dependent: :destroy

  validates :email, presence: true, uniqueness: true, format: { with: URI::MailTo::EMAIL_REGEXP }

  normalizes :email, with: ->(email) { email.strip.downcase }
end
```

**app/models/session.rb:**
```ruby
class Session < ApplicationRecord
  belongs_to :user

  before_create { self.token = SecureRandom.urlsafe_base64(32) }
end
```

**app/models/magic_link.rb:**
```ruby
class MagicLink < ApplicationRecord
  belongs_to :user

  before_create do
    self.code = SecureRandom.random_number(100_000..999_999).to_s
    self.expires_at = 15.minutes.from_now
  end

  scope :active, -> { where("expires_at > ?", Time.current) }

  def expired?
    expires_at < Time.current
  end

  def verify!(entered_code)
    return false if expired?
    return false unless code == entered_code

    destroy!
    true
  end
end
```

**app/models/current.rb:**
```ruby
class Current < ActiveSupport::CurrentAttributes
  attribute :session

  delegate :user, to: :session, allow_nil: true
end
```

### 3.3 Create Authentication Concern

**app/controllers/concerns/authentication.rb:**
```ruby
module Authentication
  extend ActiveSupport::Concern

  included do
    before_action :authenticate
    helper_method :current_user, :signed_in?
  end

  private
    def authenticate
      Current.session = find_session
      redirect_to new_session_path, alert: "Please sign in" unless Current.session
    end

    def find_session
      if bearer_token = request.headers["Authorization"]&.split(" ")&.last
        Session.find_by(token: bearer_token)
      else
        Session.find_by(id: cookies.signed[:session_id])
      end
    end

    def current_user
      Current.user
    end

    def signed_in?
      Current.session.present?
    end

    def sign_in(user)
      session = user.sessions.create!
      cookies.signed.permanent[:session_id] = { value: session.id, httponly: true }
      Current.session = session
    end

    def sign_out
      Current.session&.destroy
      cookies.delete(:session_id)
      Current.session = nil
    end
end
```

### 3.4 Create Controllers

**app/controllers/application_controller.rb:**
```ruby
class ApplicationController < ActionController::Base
  include Authentication

  allow_browser versions: :modern
end
```

**app/controllers/sessions_controller.rb:**
```ruby
class SessionsController < ApplicationController
  skip_before_action :authenticate, only: [:new, :create]

  def new
  end

  def create
    user = User.find_by(email: params[:email])

    if user
      magic_link = user.magic_links.create!
      AuthenticationMailer.magic_link(user, magic_link).deliver_later
    end

    redirect_to verify_magic_link_path, notice: "Check your email for a sign-in link"
  end

  def destroy
    sign_out
    redirect_to new_session_path, notice: "Signed out successfully"
  end
end
```

**app/controllers/magic_links_controller.rb:**
```ruby
class MagicLinksController < ApplicationController
  skip_before_action :authenticate

  def verify
    @email = params[:email]
  end

  def authenticate
    user = User.find_by(email: params[:email])
    magic_link = user&.magic_links&.active&.last

    if magic_link&.verify!(params[:code])
      sign_in(user)
      redirect_to root_path, notice: "Signed in successfully"
    else
      redirect_to verify_magic_link_path(email: params[:email]), alert: "Invalid or expired code"
    end
  end
end
```

**app/controllers/pages_controller.rb:**
```ruby
class PagesController < ApplicationController
  skip_before_action :authenticate, only: [:home]

  def home
  end

  def dashboard
  end
end
```

### 3.5 Create Mailer

**app/mailers/authentication_mailer.rb:**
```ruby
class AuthenticationMailer < ApplicationMailer
  def magic_link(user, magic_link)
    @user = user
    @code = magic_link.code

    mail(to: user.email, subject: "Your sign-in code")
  end
end
```

**app/views/authentication_mailer/magic_link.html.erb:**
```erb
<h1>Sign in to <%= Rails.application.class.module_parent_name %></h1>

<p>Your sign-in code is:</p>

<h2 style="font-size: 32px; letter-spacing: 4px; font-family: monospace;"><%= @code %></h2>

<p>This code expires in 15 minutes.</p>

<p>If you didn't request this, you can safely ignore this email.</p>
```

**app/views/authentication_mailer/magic_link.text.erb:**
```erb
Sign in to <%= Rails.application.class.module_parent_name %>

Your sign-in code is: <%= @code %>

This code expires in 15 minutes.

If you didn't request this, you can safely ignore this email.
```

### 3.6 Create Views

**app/views/sessions/new.html.erb:**
```erb
<div class="min-h-screen flex items-center justify-center">
  <div class="max-w-md w-full space-y-8 p-8">
    <h2 class="text-3xl font-bold text-center">Sign in</h2>

    <%= form_with url: session_path, class: "mt-8 space-y-6" do |f| %>
      <div>
        <%= f.label :email, class: "block text-sm font-medium" %>
        <%= f.email_field :email, required: true, autofocus: true,
            class: "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" %>
      </div>

      <%= f.submit "Send sign-in code", class: "w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 cursor-pointer" %>
    <% end %>
  </div>
</div>
```

**app/views/magic_links/verify.html.erb:**
```erb
<div class="min-h-screen flex items-center justify-center">
  <div class="max-w-md w-full space-y-8 p-8">
    <h2 class="text-3xl font-bold text-center">Enter your code</h2>
    <p class="text-center text-gray-600">We sent a 6-digit code to your email</p>

    <%= form_with url: authenticate_magic_link_path, method: :post, class: "mt-8 space-y-6" do |f| %>
      <%= hidden_field_tag :email, @email %>

      <div>
        <%= f.label :code, "Sign-in code", class: "block text-sm font-medium" %>
        <%= f.text_field :code, required: true, autofocus: true, autocomplete: "one-time-code",
            pattern: "[0-9]{6}", inputmode: "numeric", maxlength: 6,
            class: "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-center text-2xl tracking-widest" %>
      </div>

      <%= f.submit "Sign in", class: "w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 cursor-pointer" %>
    <% end %>

    <p class="text-center">
      <%= link_to "Didn't receive a code? Try again", new_session_path, class: "text-indigo-600 hover:text-indigo-500" %>
    </p>
  </div>
</div>
```

**app/views/pages/home.html.erb:**
```erb
<div class="min-h-screen flex items-center justify-center">
  <div class="text-center">
    <h1 class="text-4xl font-bold">Welcome to <%= Rails.application.class.module_parent_name %></h1>

    <div class="mt-8">
      <% if signed_in? %>
        <p class="text-lg">Hello, <%= current_user.email %>!</p>
        <%= link_to "Dashboard", dashboard_path, class: "mt-4 inline-block px-4 py-2 bg-indigo-600 text-white rounded-md" %>
      <% else %>
        <%= link_to "Sign in", new_session_path, class: "inline-block px-4 py-2 bg-indigo-600 text-white rounded-md" %>
      <% end %>
    </div>
  </div>
</div>
```

**app/views/pages/dashboard.html.erb:**
```erb
<div class="max-w-4xl mx-auto py-8 px-4">
  <div class="flex justify-between items-center mb-8">
    <h1 class="text-3xl font-bold">Dashboard</h1>
    <%= button_to "Sign out", session_path, method: :delete, class: "px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300" %>
  </div>

  <p>Welcome, <%= current_user.email %>!</p>
</div>
```

## Step 4: Configure Routes

**config/routes.rb:**
```ruby
Rails.application.routes.draw do
  # Authentication
  resource :session, only: [:new, :create, :destroy]
  get "verify", to: "magic_links#verify", as: :verify_magic_link
  post "verify", to: "magic_links#authenticate", as: :authenticate_magic_link

  # Pages
  get "dashboard", to: "pages#dashboard"

  # Health check
  get "up" => "rails/health#show", as: :rails_health_check

  root "pages#home"
end
```

## Step 5: Configure Solid Stack

### 5.1 Install Solid Queue

```bash
bin/rails solid_queue:install
```

### 5.2 Install Solid Cache

```bash
bin/rails solid_cache:install
```

### 5.3 Install Solid Cable

```bash
bin/rails solid_cable:install
```

### 5.4 Run migrations

```bash
bin/rails db:migrate
```

## Step 6: Configure Content Security Policy

**config/initializers/content_security_policy.rb:**
```ruby
Rails.application.configure do
  config.content_security_policy do |policy|
    policy.default_src :self
    policy.font_src    :self, :data
    policy.img_src     :self, :data, :blob
    policy.object_src  :none
    policy.script_src  :self
    policy.style_src   :self, :unsafe_inline
    policy.base_uri    :self
    policy.form_action :self
    policy.frame_ancestors :self

    if Rails.env.development?
      policy.script_src :self, :unsafe_inline
      policy.connect_src :self, "ws://localhost:*"
    end
  end

  config.content_security_policy_nonce_generator = ->(request) { SecureRandom.base64(16) }
  config.content_security_policy_nonce_directives = %w[script-src]
end
```

## Step 7: Setup Testing

### 7.1 Add Minitest

Create **test/test_helper.rb:**
```ruby
ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"

module ActiveSupport
  class TestCase
    parallelize(workers: :number_of_processors)
    fixtures :all
  end
end

module ActionDispatch
  class IntegrationTest
    def sign_in_as(user)
      session = user.sessions.create!
      cookies[:session_id] = session.id
    end
  end
end
```

### 7.2 Create Fixtures

**test/fixtures/users.yml:**
```yaml
alice:
  email: alice@example.com
  name: Alice

bob:
  email: bob@example.com
  name: Bob
```

**test/fixtures/sessions.yml:**
```yaml
alice_session:
  user: alice
  token: <%= SecureRandom.urlsafe_base64(32) %>
```

### 7.3 Create Tests

**test/models/user_test.rb:**
```ruby
require "test_helper"

class UserTest < ActiveSupport::TestCase
  test "email is normalized" do
    user = User.create!(email: "  ALICE@EXAMPLE.COM  ", name: "Alice")
    assert_equal "alice@example.com", user.email
  end

  test "email must be unique" do
    User.create!(email: "test@example.com", name: "Test")
    duplicate = User.new(email: "test@example.com", name: "Test 2")
    assert_not duplicate.valid?
  end
end
```

**test/models/magic_link_test.rb:**
```ruby
require "test_helper"

class MagicLinkTest < ActiveSupport::TestCase
  test "generates 6-digit code" do
    magic_link = users(:alice).magic_links.create!
    assert_match(/\A\d{6}\z/, magic_link.code)
  end

  test "expires after 15 minutes" do
    magic_link = users(:alice).magic_links.create!

    assert_not magic_link.expired?

    travel 16.minutes

    assert magic_link.expired?
  end

  test "verify! returns true for valid code" do
    magic_link = users(:alice).magic_links.create!
    code = magic_link.code

    assert magic_link.verify!(code)
    assert_nil MagicLink.find_by(id: magic_link.id)
  end

  test "verify! returns false for invalid code" do
    magic_link = users(:alice).magic_links.create!

    assert_not magic_link.verify!("000000")
    assert MagicLink.exists?(magic_link.id)
  end
end
```

**test/integration/authentication_test.rb:**
```ruby
require "test_helper"

class AuthenticationTest < ActionDispatch::IntegrationTest
  test "can sign in with magic link" do
    user = users(:alice)

    # Request magic link
    post session_path, params: { email: user.email }
    assert_redirected_to verify_magic_link_path

    # Get the code
    magic_link = user.magic_links.last
    assert_not_nil magic_link

    # Verify code
    post authenticate_magic_link_path, params: { email: user.email, code: magic_link.code }
    assert_redirected_to root_path

    # Should be signed in
    get dashboard_path
    assert_response :success
  end

  test "dashboard requires authentication" do
    get dashboard_path
    assert_redirected_to new_session_path
  end
end
```

## Step 8: Initialize Git

```bash
git init
git add -A
git commit -m "Initial commit: Rails 8 with Hotwire and custom auth

- Rails 8 with PostgreSQL and Tailwind
- Solid Queue, Cache, and Cable (no Redis)
- Custom passwordless magic link authentication
- Minitest with fixtures
- CSP configured

Generated with /build-website command"
```

## Step 9: Final Verification

Run tests:
```bash
bin/rails test
```

Start the server:
```bash
bin/dev
```

## Completion Summary

Report to the user:

```markdown
## App Created Successfully

**Location:** ./$APP_NAME

### What's Included

- Rails 8 with PostgreSQL
- Hotwire (Turbo + Stimulus)
- Tailwind CSS
- Custom passwordless authentication
- Solid Queue (background jobs)
- Solid Cache (caching)
- Solid Cable (WebSockets)
- Minitest with fixtures
- Content Security Policy

### Next Steps

1. `cd $APP_NAME`
2. Configure `config/database.yml` if needed
3. Run `bin/dev` to start the server
4. Visit http://localhost:3000

### Creating Your First User

In Rails console (`bin/rails console`):
```ruby
User.create!(email: "you@example.com", name: "Your Name")
```

Then sign in at http://localhost:3000/session/new

### Key Files

- `app/controllers/concerns/authentication.rb` - Auth logic
- `app/models/current.rb` - Request-scoped attributes
- `config/routes.rb` - RESTful routes
```
