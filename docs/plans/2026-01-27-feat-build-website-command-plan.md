---
title: feat: Add /build-website command for Rails app scaffolding
type: feat
date: 2026-01-27
---

# Add /build-website Command for Rails App Scaffolding

## Overview

Create a new `/build-website` command that scaffolds a complete Rails 8 application with Hotwire, authentication, and DHH/37signals-style conventions. This command provides a production-ready starting point following compounding engineering principles.

## Problem Statement / Motivation

Starting a new Rails project requires significant setup:
- Configuring Hotwire (Turbo + Stimulus)
- Setting up authentication
- Choosing and configuring gems
- Establishing directory structure and patterns

This command codifies best practices from the `dhh-rails-style` skill into an executable scaffold, reducing setup time and ensuring consistency with 37signals conventions.

## Proposed Solution

A slash command at `plugins/compound-engineering/commands/build-website.md` that:
1. Takes an app name as argument
2. Runs `rails new` with appropriate flags
3. Configures the Solid stack (Queue, Cache, Cable)
4. Sets up custom passwordless authentication (~150 lines, per DHH style)
5. Creates standard directory structure
6. Applies DHH Rails Style conventions

## Technical Approach

### Command Structure

**File:** `plugins/compound-engineering/commands/build-website.md`

```yaml
---
name: build-website
description: Scaffold a Rails 8 app with Hotwire, authentication, and DHH conventions
argument-hint: "[app-name]"
---
```

### Implementation Phases

#### Phase 1: Rails New with Flags

Generate base app with Rails 8 defaults:

```bash
rails new $APP_NAME \
  --database=postgresql \
  --css=tailwind \
  --skip-jbuilder \
  --skip-test \
  --skip-system-test
```

**Rationale:**
- PostgreSQL: Production-standard database
- Tailwind: Modern utility CSS (user can switch to native CSS if preferred)
- Skip jbuilder: JSON rendering handled directly
- Skip test: Will add Minitest with proper fixtures setup

#### Phase 2: Gem Configuration

**Add to Gemfile:**
```ruby
# DHH/37signals stack
gem "solid_queue"
gem "solid_cache"
gem "solid_cable"
gem "mission_control-jobs"

# Deployment
gem "kamal"
gem "thruster"

# Utilities
gem "geared_pagination"

group :development, :test do
  gem "debug"
end
```

**What we explicitly avoid (per dhh-rails-style):**
- devise (custom auth instead)
- sidekiq (use Solid Queue)
- redis (database-backed everything)
- rspec (Minitest ships with Rails)
- factory_bot (fixtures instead)

#### Phase 3: Custom Authentication

Create ~150-line passwordless magic link authentication:

**Files to create:**

1. `app/models/session.rb`
```ruby
class Session < ApplicationRecord
  belongs_to :user
  before_create { self.token = SecureRandom.urlsafe_base64(32) }
end
```

2. `app/models/magic_link.rb`
```ruby
class MagicLink < ApplicationRecord
  belongs_to :user
  before_create do
    self.code = SecureRandom.random_number(100_000..999_999).to_s
    self.expires_at = 15.minutes.from_now
  end

  def expired?
    expires_at < Time.current
  end
end
```

3. `app/models/user.rb`
```ruby
class User < ApplicationRecord
  has_many :sessions, dependent: :destroy
  has_many :magic_links, dependent: :destroy

  validates :email, presence: true, uniqueness: true
end
```

4. `app/controllers/concerns/authentication.rb`
```ruby
module Authentication
  extend ActiveSupport::Concern

  included do
    before_action :authenticate
    helper_method :current_user
  end

  private
    def authenticate
      Current.session = find_session
      redirect_to login_path unless Current.session
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
end
```

5. `app/models/current.rb`
```ruby
class Current < ActiveSupport::CurrentAttributes
  attribute :session

  delegate :user, to: :session, allow_nil: true
end
```

6. Controllers: `SessionsController`, `MagicLinksController`

7. Mailer: `AuthenticationMailer`

8. Migrations for `users`, `sessions`, `magic_links`

#### Phase 4: Directory Structure

Create standard DHH-style directories:

```
app/
├── controllers/
│   └── concerns/
│       └── authentication.rb
├── models/
│   └── concerns/
├── views/
│   └── layouts/
│       └── application.html.erb
├── helpers/
├── mailers/
│   └── authentication_mailer.rb
└── jobs/

config/
├── routes.rb (with auth routes)
└── initializers/
    └── content_security_policy.rb

test/
├── fixtures/
│   ├── users.yml
│   └── sessions.yml
├── models/
├── controllers/
└── integration/
```

#### Phase 5: Configuration

1. **database.yml** - PostgreSQL with Solid suite databases
2. **routes.rb** - RESTful auth routes
3. **Content Security Policy** - secure defaults
4. **Procfile.dev** - for development

**config/routes.rb:**
```ruby
Rails.application.routes.draw do
  # Authentication
  resource :session, only: [:new, :create, :destroy]
  resources :magic_links, only: [:new, :create] do
    member do
      get :verify
      post :verify
    end
  end

  root "pages#home"
end
```

#### Phase 6: Testing Setup

Configure Minitest with fixtures:

1. **test/test_helper.rb** - with authentication helpers
2. **test/fixtures/** - sample users, sessions
3. **test/integration/authentication_test.rb** - auth flow tests

### Command Workflow

```markdown
## Steps

1. **Validate arguments**
   - Check $ARGUMENTS contains app name
   - Sanitize app name (lowercase, hyphens)

2. **Run rails new**
   - Execute with flags above
   - cd into new directory

3. **Update Gemfile**
   - Add Solid suite gems
   - Add development gems
   - Run bundle install

4. **Generate authentication**
   - Create models: User, Session, MagicLink, Current
   - Create controllers: SessionsController, MagicLinksController
   - Create concern: Authentication
   - Create mailer: AuthenticationMailer
   - Run migrations

5. **Configure application**
   - Set up routes
   - Configure CSP
   - Set up Solid Queue/Cache/Cable
   - Create Procfile.dev

6. **Setup testing**
   - Configure Minitest
   - Create fixtures
   - Add sample tests

7. **Initialize git**
   - git init
   - Create .gitignore
   - Initial commit

8. **Report completion**
   - List created files
   - Show next steps
```

## Acceptance Criteria

### Functional Requirements

- [ ] Command accepts app name as argument
- [ ] Generates working Rails 8 application
- [ ] Authentication works (magic link flow)
- [ ] Solid Queue configured and functional
- [ ] Tests pass out of the box
- [ ] Git repository initialized

### Non-Functional Requirements

- [ ] Follows dhh-rails-style conventions
- [ ] No devise, sidekiq, redis dependencies
- [ ] Uses Minitest with fixtures
- [ ] CSP configured for security

### Quality Gates

- [ ] Generated app boots without errors
- [ ] `bin/rails test` passes
- [ ] Authentication flow works end-to-end

## Success Metrics

- App scaffolds in under 2 minutes
- Zero configuration needed to run `bin/dev`
- Authentication works out of the box

## Dependencies & Prerequisites

- Rails 8+ installed
- PostgreSQL available
- Node.js for asset compilation

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Rails 8 API changes | Low | Medium | Pin to Rails 8.x, test regularly |
| Tailwind vs native CSS debate | Medium | Low | Make CSS choice configurable via flag |
| Auth complexity | Low | Medium | Keep to ~150 lines per DHH guidance |

## Future Considerations

- Add `--css=native` flag for native CSS option
- Add `--api` flag for API-only mode
- Template selection (blog, SaaS, marketplace)
- Integration with Kamal for deployment

## References & Research

### Internal References

- DHH Rails Style skill: `plugins/compound-engineering/skills/dhh-rails-style/SKILL.md`
- Architecture patterns: `plugins/compound-engineering/skills/dhh-rails-style/references/architecture.md`
- Gems guidance: `plugins/compound-engineering/skills/dhh-rails-style/references/gems.md`

### Command Examples

- Complex command pattern: `plugins/compound-engineering/commands/xcode-test.md`
- Workflow command pattern: `plugins/compound-engineering/commands/workflows/plan.md`
- Simple command pattern: `plugins/compound-engineering/commands/lfg.md`

### External References

- Rails 8 release notes
- Solid Queue documentation
- 37signals authentication patterns from Fizzy/Campfire analysis
