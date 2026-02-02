# Rails 8 App Scaffolding Research

Research compiled for the `/build-website` command - a Rails 8 app scaffolding tool.

## Executive Summary

Rails 8 (current: v8.0.4) introduces major simplifications for new application setup:
- **Built-in authentication generator** - No need for Devise for basic auth
- **Solid Trifecta** - Database-backed Queue, Cache, and Cable (no Redis required)
- **Kamal deployment** - Zero-downtime Docker deployments built-in
- **SQLite as production option** - Viable for small-to-medium apps
- **Hotwire by default** - Turbo + Stimulus included

## Rails 8 New App Best Practices (2026)

### Recommended `rails new` Command

```bash
# Standard full-stack app with PostgreSQL
rails new myapp -d postgresql --css=tailwind

# For SQLite-based simple apps (uses Solid stack)
rails new myapp --css=tailwind

# API-only app
rails new myapp --api -d postgresql --skip-test

# Minimal app (strips most defaults)
rails new myapp --minimal
```

### Key Flags

| Flag | Purpose | Default |
|------|---------|---------|
| `-d, --database` | Database adapter | sqlite3 |
| `--css` | CSS framework | tailwind |
| `--skip-test` | Skip Minitest | false |
| `--skip-system-test` | Skip system tests | false |
| `--api` | API-only mode | false |
| `--minimal` | Lightweight app | false |

### Database Options
- `postgresql` - Recommended for production
- `sqlite3` - Now production-viable with Rails 8 Solid stack
- `mysql` / `trilogy` - MySQL options
- `mariadb-mysql` / `mariadb-trilogy` - MariaDB options

### CSS Options
- `tailwind` - Default, uses standalone CLI (no Node.js required)
- `bootstrap` - Via cssbundling-rails
- `bulma` - Via cssbundling-rails
- `postcss` - Custom CSS with PostCSS
- `sass` - SCSS support

## Authentication Recommendations

### 1. Rails 8 Built-in Generator (Recommended for Most Cases)

```bash
bin/rails generate authentication
```

**Creates:**
- User and Session models
- SessionsController for login/logout
- PasswordsController for password reset
- Authentication concern in ApplicationController
- Basic views for login and password reset

**Pros:**
- No external dependencies
- Full control over code
- Easy to customize
- Follows Rails conventions

**Cons:**
- No registration flow (must implement manually)
- No 2FA built-in
- No OAuth/social login

**When to use:** Most apps, especially those wanting full control

### 2. Authentication Zero (For More Features)

```bash
gem 'authentication-zero'
rails generate authentication_zero
```

**Additional features:**
- Registration with email verification
- Two-Factor Authentication (2FA)
- Account lockout after failed attempts
- Social login support

**When to use:** Apps needing 2FA, registration, or advanced security

### 3. Devise (For Complex Requirements)

**Still valid for:**
- Multiple user types (admin, customer, etc.)
- Complex authorization requirements
- OmniAuth integration
- Confirmable, lockable, trackable modules

**DHH/37signals approach:** They avoid Devise, using ~150 lines of custom auth code instead.

## Database & Cache Setup (Solid Trifecta)

Rails 8 introduces database-backed alternatives to Redis:

### Solid Queue (Background Jobs)
```yaml
# config/solid_queue.yml
default: &default
  dispatchers:
    - polling_interval: 1
      batch_size: 500
  workers:
    - queues: "*"
      threads: 3
      polling_interval: 0.1
```

### Solid Cache (Caching)
- FIFO cache stored in database
- Configured by default in new Rails 8 apps
- No Redis required

### Solid Cable (WebSockets)
- ActionCable backed by database
- No Redis required

### SQLite Production Configuration

```yaml
# config/database.yml
production:
  primary:
    <<: *default
    database: storage/production.sqlite3
  cache:
    <<: *default
    database: storage/production_cache.sqlite3
    migrations_paths: db/cache_migrate
  queue:
    <<: *default
    database: storage/production_queue.sqlite3
    migrations_paths: db/queue_migrate
  cable:
    <<: *default
    database: storage/production_cable.sqlite3
    migrations_paths: db/cable_migrate
```

**Benefits:** Separate databases allow parallel writes, avoiding SQLite's single-writer limitation.

## Testing Setup

### Minitest (DHH/37signals Preferred)
- Ships with Rails
- Uses fixtures
- Simpler setup

```ruby
# test/test_helper.rb
ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"
```

### RSpec (Community Standard)

```ruby
# Gemfile
group :development, :test do
  gem 'rspec-rails', '~> 8.0'
  gem 'factory_bot_rails'
  gem 'faker'
end

group :test do
  gem 'shoulda-matchers'
  gem 'database_cleaner-active_record'
end
```

```bash
rails generate rspec:install
```

**Best practices:**
- Use request specs over controller specs
- Follow testing pyramid (many unit, some integration, few system)
- Use `--profile` to find slow tests
- Run tests in parallel

## Hotwire Setup (Included by Default)

Rails 8 includes Hotwire automatically:
- **Turbo Drive** - Accelerates navigation (no setup needed)
- **Turbo Frames** - Independent page sections
- **Turbo Streams** - Real-time updates
- **Stimulus** - Modest JavaScript behavior

### Import Maps (Default)
```javascript
// config/importmap.rb
pin "@hotwired/turbo-rails", to: "turbo.min.js"
pin "@hotwired/stimulus", to: "stimulus.min.js"
pin "@hotwired/stimulus-loading", to: "stimulus-loading.js"
```

### JavaScript Bundlers (Alternative)
Use `--javascript=esbuild` or `--javascript=bun` for:
- NPM package requirements
- Complex JavaScript builds
- TypeScript support

## Deployment (Kamal)

Rails 8 includes Kamal for zero-downtime Docker deployments.

### Setup
```bash
kamal init
```

### Key Configuration (`config/deploy.yml`)
```yaml
service: myapp
image: myuser/myapp
servers:
  web:
    - 192.168.1.1
proxy:
  ssl: true
  host: myapp.com
registry:
  username: myuser
  password:
    - KAMAL_REGISTRY_PASSWORD
env:
  secret:
    - RAILS_MASTER_KEY
```

### Secrets (`.env`)
```
KAMAL_REGISTRY_PASSWORD=xxx
RAILS_MASTER_KEY=xxx
```

### Deploy
```bash
kamal deploy
```

## Rails Application Templates

Templates automate new app setup. Use with:
```bash
rails new myapp -m template.rb
rails new myapp -m https://example.com/template.rb
```

### Template API
```ruby
# template.rb
gem 'devise'
gem_group :development, :test do
  gem 'rspec-rails'
end

after_bundle do
  generate 'devise:install'
  generate 'rspec:install'
  rails_command 'db:migrate'
  git add: '.', commit: '-m "Initial commit"'
end
```

### Popular Templates
- **Jumpstart Pro** - Commercial SaaS template
- **Rails Bytes** - Component templates
- **Ackama Rails Template** - Security-focused
- **Matt Brictson's Template** - Best practices

## Command Design Recommendations

Based on existing plugin commands like `/generate_command` and `/lfg`:

### Suggested `/build-website` Flow

1. **Gather requirements** (interactive)
   - App name
   - Database choice (PostgreSQL, SQLite)
   - Authentication needs
   - Testing framework preference
   - CSS framework

2. **Generate app**
   ```bash
   rails new [name] -d [db] --css=[css] [flags]
   ```

3. **Post-generation setup**
   - Run authentication generator if needed
   - Initialize git repository
   - Configure Kamal if deployment needed
   - Add common gems

4. **Verify**
   - Run `bin/rails db:setup`
   - Run `bin/rails server` to verify
   - Run tests

### Example Command Arguments

```
/build-website saas-app --auth --postgres --rspec
/build-website blog --sqlite --minitest
/build-website api-only --api --postgres --skip-auth
```

## Sources

### Rails 8 Authentication
- [Rails 8 Built-in Authentication Generator](https://www.bigbinary.com/blog/rails-8-introduces-a-basic-authentication-generator)
- [Rails 8 Authentication and Beyond](https://medium.com/@reinteractivehq/rails-8-authentication-and-beyond-baeff80a5828)
- [Built-in Authentication Deep Dive](https://www.andriifurmanets.com/blogs/built-in-authentication-in-rails)

### Solid Stack
- [Setup Solid Queue/Cable/Cache](https://briancasel.gitbook.io/cheatsheet/rails-1/setup-solid-queue-cable-cache-in-rails-8-to-share-a-single-database)
- [Solid Queue GitHub](https://github.com/rails/solid_queue)
- [Solid Cache GitHub](https://github.com/rails/solid_cache)

### Hotwire
- [Rails 8 Hotwire Guide](https://devot.team/blog/rails-8-hotwire)
- [Turbo Documentation](https://turbo.hotwired.dev/)
- [Stimulus Rails GitHub](https://github.com/hotwired/stimulus-rails)

### Deployment
- [Kamal Documentation](https://kamal-deploy.org/)
- [Deploy Rails 8 with Kamal](https://rameerez.com/kamal-tutorial-how-to-deploy-a-postgresql-rails-app/)

### Testing
- [RSpec Rails GitHub](https://github.com/rspec/rspec-rails)
- [Rails Testing Guide](https://guides.rubyonrails.org/testing.html)
- [Better Specs](https://www.betterspecs.org/)

### Templates
- [Rails Application Templates Guide](https://guides.rubyonrails.org/rails_application_templates.html)
- [Rails Generators Guide](https://guides.rubyonrails.org/generators.html)
- [Jumpstart Pro](https://jumpstartrails.com/)
