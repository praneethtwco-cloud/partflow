# Track: Secure Advanced Sync Options

## Overview
Modify the Data Sync & Tools page to hide the "Upload All to Cloud (Overwrite)" and "Download Latest Master Record (Pull)" buttons behind a security toggle. Only the "Incremental Sync" button will be visible by default, with advanced options revealed through a toggle in the settings section.

## Functional Requirements
1. Implement a toggle switch in the settings section to control visibility of advanced sync options
2. By default, only show the "Incremental Sync" button on the sync dashboard
3. When the toggle is activated, show the "Upload All to Cloud (Overwrite)" and "Download Latest Master Record (Pull)" buttons
4. The toggle should reset each time the sync page is accessed (require reactivation)
5. Provide a subtle hint near the Incremental Sync button to indicate that more options are available when the toggle is enabled
6. Maintain all existing functionality of the advanced sync options when visible

## Non-Functional Requirements
1. The UI should remain intuitive and not confuse users about the availability of sync options
2. The toggle state should be session-based (reset when navigating away and returning to the sync page)
3. Performance should not be impacted by the addition of the toggle functionality

## Acceptance Criteria
1. When first accessing the sync page, only the "Incremental Sync" button is visible
2. A subtle indicator suggests that additional options exist
3. When the toggle in settings is activated, the advanced sync options become visible
4. When navigating away and returning to the sync page, the advanced options are again hidden
5. All sync functionality operates as expected regardless of the toggle state

## Out of Scope
1. Changing the underlying sync mechanism or conflict resolution logic
2. Adding user authentication or permission systems
3. Modifying the actual sync process beyond the UI visibility
4. Adding additional security measures beyond the toggle functionality