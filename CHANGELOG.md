# Changelog

## 2.3.0

**New Features:**
- **Statistics Table**: An optional table below the chart summarizing each series — number of measurements, mean, standard deviation, min/max, control limits (LCL/UCL), and process capability (Cp, Cpk, Pp, Ppk).
  - Turned off by default, so existing dashboards look exactly the same until you enable "Show statistics table" in the panel options
  - Choose which columns to display
  - Capability values follow the Minitab convention: they are calculated from your raw measurements and your LSL/USL specification lines, so you get the same Cp/Cpk regardless of which chart of a pair (X̄ or R/S) you are viewing
- **CSV Export**: Right-click the panel and choose "Download CSV" (or use the download button on the statistics table) to export the statistics and control line values.

**Calculation Accuracy Fixes:**

After upgrading, some charts may show slightly different control limits than before. The new values are the correct ones:

- **S chart**: The lower control limit was calculated with an incorrect factor. If you use S charts, expect the LCL line to move to its correct position.
- **Leftover measurements**: When the data doesn't divide evenly into subgroups (for example 17 measurements with subgroup size 5), the leftover measurements no longer distort the center line and control limits. The last, smaller subgroup is still drawn as a point on the chart, but limits are estimated from complete subgroups only, so they may shift slightly compared to previous versions.
- **Missing values**: Gaps in the data were previously counted as the value 0, which could visibly skew subgroup averages, ranges, and standard deviations. Missing values are now ignored, and a subgroup with no usable measurements appears as a gap in the line.
- **Too little data**: When there aren't enough measurements to calculate control limits yet, the chart no longer draws limit lines in wrong places (such as at zero). The lines appear automatically once enough data arrives.

**Security:**
- Updated third-party components to address known vulnerabilities and added an automated vulnerability check to the release process.

## 2.2.0

**New Features:**
- **Numeric X-axis Support**: Added support for numeric X-axis to enable SPC charting for indexed/sequential data sources.
  - New X-axis field selector allows switching between Time (default) and numeric fields
  - Works similarly to Grafana's built-in Trend panel
  - Perfect for analyzing data with sample numbers or sequence indices (e.g., 1, 2, 3...) instead of timestamps
- **Multi-field Control Lines**: Enhanced control line functionality for datasets with multiple numeric fields.
  - Field selector for computed control lines (LCL, UCL, Mean) when multiple numeric fields exist
  - Automatically hidden when only one numeric field is present to reduce UI complexity
  - Enables proper SPC monitoring of multiple measurements in a single dataset


**Compatibility:**
- Maintains full backward compatibility with existing time-based SPC charts

## 2.1.1

**New Features:**
- **Alerting Support**: Support for Grafana alerting with alert states and annotations displayed on the chart.
  - Alert states are now visualized directly on the chart
  - Alert annotations show historical alert events on the timeline
  - Create alerts based on SPC control limits (UCL, LCL) to detect out-of-control processes
- **Annotation Support**: Support for Grafana annotations with ability to create custom annotations directly on the chart.

**Enhancements:**

- **Dependency Upgrades**: Updated all dependencies to latest versions for improved security and performance.

**Compatibility:**

- Now supports **React 19**.
- Now supports **Grafana 13**.

## 2.0.2
**New Features:**
- **Complete panel rewrite** for improved performance and functionality.
- **Added support for XmR chart** creation.
- Added support for **Custom Control Lines** to pull dynamic values from **Feature Series**.
- **Brand New SPC Editor**: A completely redesigned editor for setting up and customizing SPC charts with an intuitive user interface.
- **Threshold Colors:** Ability to add color thresholds to every control line for better visualization.
- **Multiple Series Support:** Enhanced functionality to handle multiple data series.s
- **Customization Options:**
	- Customization of legend, tooltip, axis, and graph styles.
	- Introduced a **subgroupSize** dashboard variable to control subgroup size across multiple panels.

**Enhancements:**

- **Improved SPC calculations**: Enhanced accuracy in statistical process control.

**Changes:**

- **License Update**: Changed from Apache 2.0 to **AGPL-3.0-only**.
  
**Compatibility:**

- Now supports **Grafana 11**.

## 1.0.3 (2024-04-16)

### Bug fixes
- Compatibility issue with Grafana 10.4.x (undefined reading 'Area') has been resolved.
- Bug with displaying colors in constants has been fixed.

### Features and enhancements
- Ability to enter custom Sample size value has been added.
- New chart display styles: lines, smooth line, points, bars.
- Example demonstrating how to build a SQL query and use constants on a chart. See [documentation](https://docs.kensobi.com/panels/spc) for more information.


## 1.0.2 (2024-01-20)

- Fix scaling of panel options.
- Fix deprecated values.
- Add backward compatibility to Grafana >=9.5.7.
- Add ability to enter additional constants columns taken from the database using SQL entered as Table. See [documentation](https://docs.kensobi.com/panels/spc) for more information.

