#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: >
  Build an IPTV mobile application for Android (APK) using the Xtream Codes API.
  The app must include Live TV (with inline player + TV guide, EPG), VOD, Series, Catch-up, 
  and EPG data. Core features include: login screen, home screen with hero player and recently 
  watched/added content, live TV with category filters and inline player + TV guide below,
  fullscreen player with Tubi-style UI (channel switching, logo flash, EPG overlay, landscape lock).

backend:
  - task: "FastAPI proxy for Xtream Codes API"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "All backend proxy endpoints implemented and working."

  - task: "EPG batch endpoint /api/epg/batch"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 1
    priority: "high"
    needs_retesting: true
    status_history:
      - working: false
        agent: "main"
        comment: "Rate limiting causing 503 errors when fetching individual EPG per channel"
      - working: true
        agent: "main"
        comment: "Batch endpoint implemented with 150ms delay between requests. Route ordering fixed - /epg/batch now declared BEFORE /epg/{stream_id} to prevent route conflicts."

  - task: "Stream URL resolution (LB redirect handling)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Stream URL resolution with LB redirect handling implemented."

frontend:
  - task: "Login screen"
    implemented: true
    working: true
    file: "frontend/app/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Login screen working with password visibility toggle."

  - task: "Home screen with hero player and recent content"
    implemented: true
    working: true
    file: "frontend/app/(tabs)/home.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Hero player plays last watched channel, recently watched, added movies, added series all implemented."

  - task: "Live TV screen with inline player + TV guide"
    implemented: true
    working: "NA"
    file: "frontend/app/(tabs)/live.tsx"
    stuck_count: 2
    priority: "high"
    needs_retesting: true
    status_history:
      - working: false
        agent: "main"
        comment: "EPG data not loading due to rate limiting."
      - working: "NA"
        agent: "main"
        comment: "Fixed EPG timestamp parsing to use start_timestamp/stop_timestamp directly. Fixed web player height. Uses new /api/epg/batch endpoint. Needs testing to verify EPG data shows in TV guide."

  - task: "Fullscreen player (Tubi-style)"
    implemented: true
    working: "NA"
    file: "frontend/app/player.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Tubi-style player with channel switching, logo flash, EPG overlay all implemented."
      - working: "NA"
        agent: "main"
        comment: "Added expo-screen-orientation landscape lock on mount, unlock on back button press. Fixed EPG timestamp parsing. Needs verification."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 1
  run_ui: true

test_plan:
  current_focus:
    - "EPG batch endpoint /api/epg/batch"
    - "Live TV screen with inline player + TV guide"
    - "Fullscreen player (Tubi-style)"
  stuck_tasks:
    - "Live TV screen EPG display"
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: >
      Fixed the following issues:
      1. EPG timestamp parsing: Changed to use start_timestamp/stop_timestamp (Unix timestamps) 
         instead of new Date(e.start) which was unreliable with the Xtream API date format.
      2. Backend route ordering: Moved /api/epg/batch BEFORE /api/epg/{stream_id} to ensure 
         literal path takes precedence.
      3. Player orientation: Added expo-screen-orientation landscape lock when entering player screen.
      4. Web player height: Capped at 240px on web.
      
      Test focuses:
      - Call GET /api/epg/batch?username=TEST&password=TEST&stream_ids=1,2,3 and verify it returns data
      - Navigate to Live TV tab, tap a channel, verify EPG data shows (current program, progress bar, next program)
      - Tap the fullscreen button on the inline player, verify it goes to player.tsx
      - The player should lock to landscape orientation (only testable on actual device/android)
      
      Auth credentials for testing: Use the app's login screen. Test credentials are the Xtream 
      credentials stored in the user's session (not hardcoded here for security).