# Functions Documentation

## Introduction
The SPC (Statistical Process Control) Panel allows you to visualize and analyze your data using three main charts: X-bar chart, R-bar chart, and S-bar chart. Each chart serves a specific purpose in monitoring and maintaining the stability of your processes.

### X-Bar Chart
The X-bar chart is designed to monitor the central tendency of your process over time. It calculates the average of sample means, providing insights into the overall process mean.

<b>Aggregation Type:</b> Mean


### R-Bar Chart
The R-bar chart focuses on the variability within your process by monitoring the range of samples. It calculates the average of ranges (R-bar) to assess the consistency of your process.

<b>Aggregation Type:</b> Range

### S-Bar Chart

The S-bar chart is used to monitor the variability within your process by assessing the standard deviation of samples.

<b>Aggregation Type:</b> Standard Deviation

### Shewhart individuals control chart

In statistical quality control, the individual/moving-range chart is a type of control chart used to monitor variables data from a business or industrial process for which it is impractical to use rational subgroups.

<b>Chart types:</b> Time series (data without aggregation); Moving-range (Moving-range chart)

## Control Limits Calculation

It's important to note that X-bar charts can have up to four control limits, depending on the type of chart and the desired analysis.


### X-bar charts
The control limits for <b>X-bar charts</b> are calculated as follows:

UCL-Rbar: X-bar + A2 * R-bar

LCL-Rbar: X-bar - A2 * R-bar

UCL-Sbar: X-bar + A3 * S

LCL-Sbar: X-bar - A3 * S

### R-bar charts

For <b>R-bar charts</b>, the control limits are calculated as follows:

UCL: D4 * R-bar

LCL: D3 * R-bar

### S-bar charts

For <b>S-bar charts</b>, the control limits are calculated as follows:

UCL: B4 * S

LCL: B3 * S

### Shewhart individuals control chart

For <b>Moving-range charts</b>, the control limits are calculated as follows:

UCL: D4 * MR-bar 

LCL: D3 * MR-bar

_Where D4 and D3 is taken from the sample constants for n=2._

For <b>Time series charts</b>, the control limits are calculated as follows:

UCL: X-bar + 2,66 * MR-bar

LCL: X-bar - 2,66 * MR-bar


### Constants
The values A2, A3, D3, D4, B3, B4 are constants configured for calculations in the SPC panel. The values are also available as an [SQL script](https://gist.github.com/mrtomeq/e5d7a3d6321444ed89b263998c8e537b).

