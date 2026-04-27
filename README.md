# Class List Optimizer

Create balanced class lists in minutes. No more spreadsheet juggling.

![App Screenshot](docs/images/app-screenshot.png)

Class List Optimizer automatically distributes students across classrooms while balancing academic scores, intervention needs, gender, and more. It runs entirely in your browser: **your student data never leaves your computer.**

---

## Why Use It?

Building fair class lists by hand is time-consuming and hard to get right when you're balancing a dozen factors at once. This tool:

- **Saves time.** Go from a student roster to balanced class lists in minutes.
- **Balances your criteria:** Scores, SPED, Extended Learning, ELL, behavior, interventions, gender, and class size all at once. No more juggling factors one at a time.
- **Handles constraints:** Keep specific students together (siblings, support pairs) or apart (conflicts, separations).
- **Consistent and defensible:** the same data always produces the same result so that you and your teammates can reproduce your results.
- **Private**: Runs entirely in your browser with third party server or data transmission off of your machine. Private student data stays private.
- **Scalable**: This tool can handle rosters of any size, from small to large schools. The optimization runs in seconds even with thousands of students and hundreds of classes.

---

## Download & Open

1. Go to the **[Releases](../../releases)** page
2. Download the latest `class-list-optimizer-vX.Y.Z.html` file
3. **Double-click** to open in any modern browser (Chrome, Safari, Firefox, Edge)

That's it. No installation, no account, no internet connection required.

---

## Walkthrough

### Step 1 — Configure Your Criteria

> **Do this before importing students.** Your criteria configuration determines what columns the optimizer expects in your CSV.

Click **⚙ Settings** in the top-right corner to configure what the optimizer balances.

**Numeric criteria** are score columns where a higher number means stronger performance (e.g., reading, math, or language scores on a 0–100 scale). The optimizer balances the average score of each class. **Scores are optional.** If you don't have them, simply remove those criteria or leave the columns blank.

**Flag criteria** are yes/no attributes (e.g., Extended Learning, SPED, ELL, behavior). The optimizer spreads students with each flag evenly across classes.

The optimizer also always balances **gender** and **class size** automatically. You don't need to configure those.

**Weights** control how hard the optimizer works to balance each factor. A weight of `2.0` means that criterion is twice as important as one with weight `1.0`. The defaults are a reasonable starting point for most schools. Raise a weight if one factor matters most to you.

---

### Step 2 — Set Up Your Classes

In the **Teachers / Classes** panel on the left:

- Set the **number of classes**
- Give each class a name: teacher names, room numbers, or anything you like

---

### Step 3 — Add Your Students

**Option A: Import a CSV** *(recommended for most rosters)*

1. Click **⬆ Import CSV** and paste your data

Your CSV needs at minimum a `name` column and a `gender` column (`M` or `F`). All score and flag columns are optional — leave them blank if you don't have that data. For flag columns, use `1` or `yes` (or `true`, `y`, `x`) for yes, and `0` or leave blank for no.

**Import appends** to your current student list. Use the **Clear All** button first if you want to replace your entire list.

**Constraint Columns (optional):**
- `keep_apart_group` — students with the same value will be kept in different classes
- `keep_together_group` — students with the same value will be kept in the same class

Example CSV:
```
name,gender,readingScore,keep_apart_group,keep_together_group
Alice,F,85,1,
Bob,M,78,1,
Charlie,M,70,,1
Diana,F,92,,1
```

**Option B: Add students manually**

Click **+ Add Student** to enter students one at a time using a form.

**Option C: Try sample data**

Click **Sample Data** to generate a randomized roster for testing or demonstration. This creates realistic test data so you can see how the optimizer works before entering your real students.

**Need a template?**

Generate sample data first, then click **⬇ Save Students** to save a CSV with the correct column headers for your criteria configuration. Use that as a template for your real data.

---

### Step 4 — Optimize

Click **Optimize Classes →** at the bottom of the screen. The optimizer runs automatically (usually in under a second) and takes you straight to your results.

---

## Understanding Your Results

### Balance Score

The **Balance score** in the toolbar tells you how evenly your classes are distributed across all criteria combined. Lower is better.

| Score | Color | What it means |
|-------|-------|---------------|
| < 0.05 | 🟢 Green | Excellent — classes are very evenly balanced |
| 0.05–0.15 | 🟡 Amber | Good — minor imbalances remain |
| > 0.15 | 🔴 Red | Notable imbalance — consider re-optimizing or reviewing manually |

With a typical roster, the optimizer usually reaches green.

### Per-Class Stats

At the bottom of each class column you'll see:
- **Score bars:** each bar shows how that class's average compares across all classes. All bars at the same height means perfect balance.
- **Flag badges:** a count of students with each active flag (e.g., "ExtL 3", "SPED 2")

### Stats Strip

The strip at the bottom of the screen shows a mini bar chart for every criterion across all classes. The **CV%** number under each chart is a technical measure of how spread out the classes are. You don't need to understand the math. Just know that lower is better, and green means you're in good shape.

---

## Fine-Tuning

### Drag and Drop

Drag any student card to move them to a different class. The balance score updates live so you can see the impact of each move. There is no undo for drag-and-drop. If you move someone by mistake, just drag them back, or click **⟳ Re-Optimize** to start fresh from the current locked assignments.

Click on any student card to view their full detail.

### Locking Students

Sometimes a student must be in a specific class (a separation request, a particular teacher, a support need). Use the 🔒 button on any student card to **lock** them to their current class.

Once you've locked the students who need to stay put, click **⟳ Re-Optimize** to redistribute only the unlocked students around them.

You can also use **Lock All** and **Unlock All** in the toolbar for bulk changes.

> **Recommended workflow:** Run the initial optimization first. Then lock any students where you need to override the placement, and click Re-Optimize to let the optimizer work around your manual decisions.

### Student Constraints

Click **🔗 Constraints** on the Setup page to keep specific students together or apart:

- **Keep Apart** — select 2+ students; each pair will be placed in different classes
- **Keep Together** — select 2+ students; they'll be placed in the same class

Constraints are treated as high-priority requests, not absolute rules. If the optimizer can't satisfy all constraints, you'll see a **⚠️ X violations** badge. Click it to see which constraints were violated and why. Common reasons:
- Conflicting constraints (e.g., A must be with B, but A must be apart from C, and B and C are together)
- Class size limits (asking 15 students to stay together when classes max at 12)
- Balance trade-offs where satisfying constraints would make classes extremely unbalanced

Constraints are cleared when you import new students. Use the `keep_apart_group` and `keep_together_group` CSV columns to persist them.

### Export

At any time, you can export your student data:

- **On the Setup page:** Click **⬇ Save Students** to save a CSV with all student data (useful as a template or for backup)
- **After optimizing:** Click **⬇ Save Lists** in the toolbar to save class assignments with all student data

Open the CSV in Excel or Google Sheets to format it, print it, or share it with your principal.

### Save & Load Projects

Working on class lists over multiple sessions? Use **Save Project** and **Load Project** in the header to preserve your complete working state:

- Saves all students, classes, criteria settings, constraints, and optimization results
- Perfect for saving progress and continuing later
- Validates compatibility when loading (warns about version or criteria mismatches)
- Keyboard shortcuts: **Ctrl+S** to save, **Ctrl+O** to load

Project files are JSON format and contain all student data—store them securely.

---

## Privacy & Security

**Your data never leaves your computer.**

- Runs entirely in your browser. No internet connection needed after download.
- No data is sent to any server
- No accounts, no logins, no tracking
- Works completely offline

For detailed security information, architecture details, and verification steps for IT professionals, see [docs/SECURITY.md](docs/SECURITY.md).

---

## System Requirements

Any modern web browser (Chrome, Safari, Firefox, Edge) on Mac, Windows, or Linux. No installation required.

---

## License

MIT. Free to use, modify, and share.

---

## Support This Project

**Want to donate? Don't.** Please consider donating to organizations that support your local teachers or teachers in communities of need. Long-term support of this tool is not guaranteed, but it exists to help benefit the public good.

If you have the ability to support by contributing to this tool or providing feedback to improve it, please do so! See the [Contributing](#contributing) section for more info.

---

## Questions or Bugs?

Found an issue or have a feature request? [Open an issue](../../issues) on GitHub.

Interested in contributing? See [CONTRIBUTING.md](CONTRIBUTING.md).
