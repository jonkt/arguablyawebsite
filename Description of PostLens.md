# AI CONTEXT - PostLens Email Analytics

> **PURPOSE**: Context file for AI agents working on this codebase. Optimized for token efficiency.

---

## TECH STACK (DO NOT UPGRADE)

```
Python: 3.x (no version specified in requirements)
PyQt5: latest (GUI framework)
pandas: latest (DataFrame operations)
matplotlib: latest (plotting)
pypff (libpff-python): latest (PST file parsing - C bindings)
networkx: latest (graph visualization)
wordcloud: latest (word clouds)
TextBlob: latest (NLP)
numpy: latest (numerical ops)
mplcursors: latest (interactive plots)
pyinstaller: latest (build .exe)
```

**CRITICAL**: `pypff` requires Visual C++ compiler. Not pip-installable on all systems.

---

## PROJECT STRUCTURE (TOKEN-EFFICIENT)

```
main.py                  # GUI (~1250 LOC, refactored) - PostLensApp class
ui/
  styles.py              # Dark theme CSS generator
  file_handling.py       # File locking, VSS, and preparation logic
  widgets.py             # DraggableNodes, WorkflowStepWidget, WorkflowPanel, ChartWidget
  dialogs.py             # PasswordDialog, FilterDialog, FilterTimeDialog, etc.
  tabs.py                # Tab initialization functions
  contact_list_tab.py    # Contact List tab (Table + CSV export)
  chart_renderers.py     # Chart plotting functions (render_*)
core/
  fast_parser.py        # ⚡ Minimal PST extraction (email.utils parsing)
  email_parser.py       # Full extraction (STREAMING mode)
  pst_processor.py      # PST I/O, caching
  mode_manager.py       # FAST vs STREAMING decision
analysis/
  analyzer.py           # Email-to-name mapping (type hints)
  contact_analyzer.py   # Owner detection, is_sent classification (type hints)
  response_time_analyzer.py  # Threading, response times
  filters.py            # Centralized filtering logic (Calendar, Auto-reply, Contacts)
workers/
  analysis_worker.py    # Main orchestration (discovery→parse→analyze)
  visualization_worker.py  # Chart data filtering
  utility_workers.py    # Encryption check, file locks
utils/
  cache.py              # LRU caches
  helpers.py            # PST encryption detection, resource paths (type hints)
  outlook_integration.py  # win32com Outlook automation
  shadow_copy.py        # Windows VSS for locked files
tests/
  conftest.py           # Shared pytest fixtures
  test_contact_analyzer.py  # 17 tests
  test_analyzer.py      # 7 tests
  test_email_parser.py  # 8 tests
  test_helpers.py       # 8 tests
  test_visualization_worker.py  # 18 tests
  test_chart_renderers.py  # 7 tests
```

---

## CODING PATTERNS (INFERRED)

### Style
- **Classes**: PyQt5 widgets, workers (QThread), domain objects
- **Functions**: Data processing, analysis, parsing
- **Type hints**: Added to core modules (`analysis/`, `core/email_parser.py`, `utils/helpers.py`)
- **Error handling**: Broad `except:` blocks (suppress errors, continue processing)
- **Comments**: Sparse. Use docstrings for functions, not classes

### Naming
- **snake_case**: Functions, variables, modules
- **PascalCase**: Classes
- **UPPERCASE**: Constants (rare)
- **Prefixes**: 
  - `on_` = PyQt slots/callbacks
  - `get_` = Getters
  - `extract_` = Data extraction
  - `detect_` = Detection logic
  - `analyze_` = Analysis functions

### Anti-Patterns OBSERVED
- Global caches in `pst_processor.py` (`_worker_pst_cache`)
- Multiprocessing uses global state (works due to process-local copies)

---

## CRITICAL RULES (DO NOT BREAK)

### 1. Email Parsing
```python
# ✅ CORRECT - Use email.utils
from email.utils import parseaddr, getaddresses, formataddr
name, email = parseaddr("John Doe <john@example.com>")
recipients = [formataddr(pair) for pair in getaddresses([headers['To']])]

# ❌ WRONG - Never use regex for email headers
email = re.search(r'<([^>]+)>', header).group(1)  # WILL BREAK
```

**Why**: RFC 2822 emails have complex quoting, line folding, escaping. Regex fails on edge cases.

### 2. DataFrame Columns Must Match Tuple
```python
# fast_parser.py returns tuple:
(sender_email, recipients, timestamp, folder, source_pst, 
 message_id, in_reply_to, references, subject, sender)  # 10 fields

# analysis_worker.py DataFrame columns MUST match:
columns=['sender_email', 'recipients', 'timestamp', 'folder',
         'source_pst', 'message_id', 'in_reply_to', 'references', 
         'subject', 'sender']  # 10 fields, same order

# If you add a field: Update BOTH
```

### 3. Worker Count <= 20
```python
# DO NOT increase beyond 20 workers for PST parsing
# Tested: 28 workers = 40% SLOWER than 16 workers
# Reason: PST file I/O contention (all workers hit same file)
```

### 4. Parse Headers Once Per Message
```python
# ✅ CORRECT
headers = Parser().parsestr(msg.get_transport_headers())  # Parse ONCE
sender = headers.get('From')
recipients_to = headers.get('To')
message_id = headers.get('Message-ID')

# ❌ WRONG
headers1 = Parser().parsestr(msg.get_transport_headers())
sender = headers1.get('From')
headers2 = Parser().parsestr(msg.get_transport_headers())  # Wasteful!
recipients = headers2.get('To')
```

### 5. Owner Detection Requires Sent Folder
- Looks for folders matching regex `r'Sent|Sent Items'`
- Finds most common `sender_email` in those folders
- **MAPI Recovery**: `fast_parser` iterates MAPI props (0x0C1F/0x5D01/0x0065) + Transport Headers (0x007D) to find email if standard call fails.
- If broken: All charts show 0 sent messages

### 6. Charts Need `is_sent` Column
- Added by `contact_analyzer.determine_is_sent()`
- Uses: folder name OR sender matches owner
- If broken: Social graph has no center, reciprocity chart empty

### 7. Multi-Owner Mode Wrappers
- **Condition**: `analysis_results['is_multi_owner'] == True`
- **Rule**: NEVER assume a single owner in visualization code.
- **Rule**: `owner_node` can be `None`. Handle it in renderers.
- **UI**: Hide "Response Times" and "Reciprocity" charts (they imply single ego-network).

### 8. Calendar Filtering Reliability
- `pypff` often returns empty `message_class`.
- **Rule**: MUST check subject patterns (e.g. "Accepted:", "Invitation:") AND MIME-decode subjects.
- **Rule**: Strip "Re:/Fwd:" prefixes before checking patterns.

### 9. Chart & Identity Rules
- **Display**: Use "View-Specific Sorting" for Top Communicators (Sent Only = Sort by Sent).
- **Identity**: Use "Unkeyed Alias Resolution" (`consolidate_identities`) to link Name-Only aliases to Canonical Names (e.g. "Jon" -> "Jonathan").
- **Exclusion**: Filter owner using `owner_aliases` (full set of emails+names), never just `owner_email`.

---

## DATA FLOW (FAST MODE - 90% OF USE)

```
1. User selects PST files
   ↓
2. UtilityWorker.run() - check encryption, locks
   ↓
3. ProcessingMode.select_mode() - FAST if file < 40% RAM
   ↓
4. AnalysisWorker.run_fast_mode()
   ├─ Discovery: discover_pst_chunks_adaptive()
   │   └─ Returns: List[(pst_path, folder_stack, start_idx, count, passwords)]
   ├─ Parsing: Pool.map(process_pst_chunk_fast, chunks)
   │   └─ Returns: List[Tuple[10 fields]]
   ├─ DataFrame: pd.DataFrame.from_records(all_records, columns=[...])
   └─ Analysis:
       ├─ analyzer.analyze_email_data() → email_to_name mapping
       ├─ contact_analyzer.detect_pst_owners() → owner_email
       ├─ contact_analyzer.determine_is_sent() → df['is_sent']
       └─ response_time_analyzer.analyze_response_times() → response_times df
   ↓
5. VisualizationWorker.run() - filter by date/contacts
   ↓
6. PostLensApp.update_charts() - matplotlib rendering
```

---

## COMMON TASKS

### Add a New Chart
```python
# 1. Define placeholder in ui/tabs.py:
render_placeholder(ax, "Load data...")

# 2. Calculate data in VisualizationWorker.run():
chart_data['my_new_data'] = {...}

# 3. Add plot function in ui/chart_renderers.py:
def render_my_chart(fig, ax, data):
    ax.clear()
    # ... matplotlib plotting
    return ax
    
# 4. Add calling code in PostLensApp:
def on_chart_data_ready(self, chart_data):
    if 'my_new_data' in chart_data:
        render_my_chart(self.my_fig, self.my_ax, chart_data['my_new_data'])
        self.my_canvas.draw()
```

### Add View Filter to Chart (Sent/Received)
```python
# Pattern used in Content Analysis tab:
# 1. Add QComboBox in init method:
self.content_view_mode_combo = QComboBox()
self.content_view_mode_combo.addItems(["Sent and Received", "Sent Only", "Received Only"])
self.content_view_mode_combo.currentTextChanged.connect(self.change_content_view_mode)

# 2. Filter data by is_sent column:
if view_mode == "Sent Only":
    view_df = filtered_df[filtered_df['is_sent']]
elif view_mode == "Received Only":
    view_df = filtered_df[~filtered_df['is_sent']]
else:
    view_df = filtered_df

# 3. Cache results, generate default first, background others:
QTimer.singleShot(100, lambda: self.generate_background_visuals(current_view))
```

### Fix Performance Issue
```python
# Check timings in console output:
# "Timings: discovery: X | parsing: Y | analysis: Z | visualization: W"

# Parsing is slowest (60-70% of total time)
# Optimize by:
# 1. Reduce fields extracted (fast_parser.py)
# 2. Check worker count (should be 16-20)
# 3. Check mode selection (FAST vs STREAMING)
```

### Debug "Charts Empty"
```python
# Check console for:
# "DEBUG: Detected Owner Email: ..." - should NOT be empty
# "DEBUG: Owner Aliases: {...}" - should have at least 1 email
# "Detected aliases: ..." - in final output

# If owner not detected:
# 1. Check that Sent folder exists and has messages
# 2. Check that sender_email is populated in DataFrame
# 3. Check contact_analyzer.detect_pst_owners() debug prints

# If is_sent column all False:
# 1. Check determine_is_sent() logic
# 2. Verify owner_email matches senders in Sent folder
```

---

## TESTING PROTOCOL

### Automated Tests (pytest)

```bash
# Run all 70 tests
python -m pytest tests/ -v

# Run with coverage
python -m pytest tests/ --cov=analysis --cov=core --cov=utils
```

**Test Coverage:**
- `test_contact_analyzer.py` - 17 tests (clean_name, extract_info, mapping, detection)
- `test_analyzer.py` - 7 tests (analyze_email_data pipeline)
- `test_email_parser.py` - 8 tests (MIME decoding, message processing)
- `test_helpers.py` - 8 tests (PST encryption detection)
- `test_visualization_worker.py` - 18 tests (word cleaning, calendar detection, auto-reply detection)
- `test_chart_renderers.py` - 7 tests (chart rendering logic)

### Manual Testing

```bash
# Run app
python main.py

# Test files (in project root):
sample(el2).pst   # 486MB  - Small
sample(pe).pst    # 1.26GB - Medium
sample(gr).pst    # 4.1GB  - Medium-Large
sample(la).pst    # 6.45GB - Large
sample(ln).pst    # 17.5GB - Large
sample(el).pst    # 39.5GB - Huge

# Verification checklist:
□ All 6 charts render (Top 20, Response Times, Social Graph, Reciprocity, Heatmap)
□ Contact names display (not emails)
□ Owner detected in console
□ Response time charts populated
□ Social graph has center node ("Me")
□ Filters work (time, contacts)
□ No errors in console
□ Contact List tab works + CSV Export
```

### Performance Benchmarks (32 cores, 64GB RAM)
```
sample(el2).pst   # Expected: ~4s total
sample(pe).pst    # Expected: ~10s total
sample(gr).pst    # Expected: ~10s total
sample(la).pst    # Expected: ~40s total
sample(ln).pst    # Expected: ~260s total (was 217s before name fix)
sample(el).pst    # Expected: ~1139s total

# If significantly slower:
# - Check worker count
# - Check mode selection
# - Check header parsing (should be once per message)
```

### Build Test
```bash
# Windows only
build.bat

# Should create: dist/main.exe (~150MB)
# Test: Double-click main.exe, verify it runs
```

---

## COMMON ERRORS & FIXES

### "ValueError: X columns passed, passed data had Y columns"
```python
# Cause: DataFrame columns don't match tuple length
# Fix: Count fields in fast_parser return tuple (should be 10)
#      Count columns in analysis_worker DataFrame (should be 10)
#      Ensure they match exactly
```

### "Charts show 0 sent messages"
```python
# Cause: is_sent column all False OR owner not detected
# Fix 1: Check owner detection in contact_analyzer.detect_pst_owners()
# Fix 2: Check determine_is_sent() logic
# Fix 3: Verify sender_email populated for Sent folder messages
```

### "Names show as emails"
```python
# Cause: sender/recipients don't have full headers with names
# Fix: Check fast_parser.py extracts headers using email.utils
#      Verify sender = "Name <email>" not just "email"
#      Verify recipients = ["Name <email>", ...] not ["email", ...]
```

### "App crashes on multiprocessing"
```python
# Cause: Windows multiprocessing needs if __name__ == '__main__':
# Fix: Ensure main.py has guard:
if __name__ == '__main__':
    multiprocessing.freeze_support()  # For PyInstaller
    app = QApplication(sys.argv)
    # ...
```

### "Parsing very slow"
```python
# Cause 1: Too many workers (> 20)
# Fix 1: Check mode_manager.get_adaptive_worker_count()

# Cause 2: Using Parser() multiple times per message
# Fix 2: Parse headers once, reuse headers object

# Cause 3: STREAMING mode when should be FAST
# Fix 3: Check mode_manager thresholds (file should be < 40% RAM for FAST)
```

---

## BUILD NOTES

```bash
# Build command (Windows)
pyinstaller main.spec

# OR
build.bat

# Spec file (main.spec) handles:
# - Single file output
# - Icon
# - Hidden imports (PyQt5, pypff)
# - Console window (visible for debugging)

# Distribution:
# - dist/main.exe is standalone
# - No dependencies needed on target machine
# - Size: ~150MB
```

---

## KNOWN BUGS / LIMITATIONS

1. **Windows Only** - Uses win32com, ctypes for VSS
2. **No MBOX/EML** - Only PST/OST support
3. **No Incremental Updates** - Must reparse entire file
4. **Memory Intensive** - Large files need 32GB+ RAM
5. **Single Threaded UI** - Can freeze during long operations (workers help but not perfect)
6. **No Undo** - Filters/changes not reversible (must re-analyze)
7. **English Only** - No i18n/l10n

---

## PERFORMANCE COMPARISON (Before vs After Modular Refactor)

| File | Monolithic | Modular FAST | Change |
|------|-----------|--------------|--------|
| sample(el2).pst 486MB | 5.65s | 3.97s | +30% faster |
| sample(pe).pst 1.26GB | 8.76s | 10.52s | -20% slower |
| sample(gr).pst 4.1GB | 9.68s | 10.54s | -9% slower |
| sample(la).pst 6.45GB | 28.89s | 40.77s | -41% slower |
| sample(ln).pst 17.5GB | 386s | 217s | +44% faster |
| sample(el).pst 39.5GB | ~1048s | 1010s | +3.6% faster |

**Trade-off**: Slower on medium files (1-6GB) for correctness. Large files (>10GB) much faster.
*Note: Run on Feb 7 2026 showing 1010s total for all files combined.*

---

## CRITICAL CONTEXT FOR AI AGENTS

### When Modifying Code:
1. **Test manually** - No automated tests exist
2. **Check all 6 charts** - Easy to break inadvertently
3. **Verify names display** - If you see emails, parsing is broken
4. **Check timings** - Each phase should be similar to benchmarks above
5. **Don't optimize without testing** - More workers ≠ faster (learned the hard way)

### When Debugging:
1. **Look at console output** - All critical info printed there
2. **Check DEBUG prints** - May still exist in code
3. **Use sample(el2).pst** - Fastest to test (4s runtime)
4. **Test on large file** - sample(ln).pst or sample(el).pst to verify scaling

### When Refactoring:
1. **Don't touch email parsing** - Current approach is correct after many iterations
2. **Don't increase worker count** - 16-20 is optimal for PST files
3. **Do use ui/ modules** - Chart renderers in `ui/chart_renderers.py`, tabs in `ui/tabs.py`
4. **Do add tests** - Put new tests in `tests/` directory
5. **Do maintain type hints** - Core modules now have type hints

---

*AI Context Version: 1.4*  
*Last Updated: 2026-02-07*  
*Optimized for: GPT-4, Claude 3+, other LLMs*
