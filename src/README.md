# SPC Chart

Welcome to the **KensoBI SPC Chart** panel for **Grafana**. This plugin enables you to easily create statistical process control (SPC) charts, including **Xbar-R**, **XbarS**, and **XmR** charts. It automatically calculates and displays control limits, with options to add your own custom limits. Additionally, you can group your samples into subgroups and aggregate them using methods such as **moving range**, **range**, **mean**, or **standard deviation**.

![Main](https://raw.githubusercontent.com/KensoBI/spc-chart/refs/heads/main/src/img/SPC-chart.png)

## Available Options

- **Xbar-R, XbarS, and XmR Charts:** Create various types of SPC charts with a single click.

- **Automatic Control Limits:** LCL (Lower Control Limit), UCL (Upper Control Limit), and mean are automatically calculated and displayed.

- **Custom Limits:** Add your own limits for more tailored analysis.

- **Subgrouping:** Group your samples into subgroups for analysis.

- **Aggregation:** Aggregate your data by moving range, range, mean, or standard deviation.
- **Alerting Support:** Support for Grafana alerting with alert states and annotations displayed on the chart.

- **Threshold Visualization:** Configure and visualize alert thresholds alongside SPC control limits.

- **Numeric X-axis Support:** Monitor indexed/sequential data (CSV imports, sample numbers, etc.) using numeric X-axis instead of time-based data. Similar to Grafana's Trend panel, enabling SPC analysis for non-time-series datasets.


## Alerting and Custom Annotations

The SPC Chart panel supports Grafana alerting with annotations:

- **Alert States:** The panel displays alert states directly on the chart, making it easy to see when alerts are firing.

- **Alert Annotations:** Historical alert events are shown as annotations on the chart timeline, providing visual context for when process control issues occurred.

- **Threshold Configuration:** Configure alert thresholds in the panel's field configuration to define when alerts should trigger. These thresholds are displayed alongside your SPC control limits.

- **SPC-Based Alerts:** Create alert rules based on SPC control limits (UCL, LCL) to automatically detect when your process goes out of statistical control. For example:
  - Alert when values exceed the Upper Control Limit (UCL)
  - Alert when values fall below the Lower Control Limit (LCL)
  - Alert on trends or patterns that indicate special cause variation

- Create custom annotations directly on the chart.

To create an alert based on SPC limits, configure an alert rule in Grafana that uses the same query as your SPC chart, and set threshold conditions based on your calculated control limits.

## Documentation

Please see the full panel documentation at [KensoBI Docs](https://docs.kensobi.com/panels/spc-chart/).

**NOTE:** The plugin comes with sample provisioned dashboards. Build and start the plugin to see them.

## Getting Help

If you have any questions or feedback, you can:

- Create an [issue](https://github.com/KensoBI/spc-chart/issues) to report bugs, issues, and feature suggestions.
- Ask a question on the [KensoBI Discord channel](https://discord.gg/cVKKh7trXU).

Your feedback is always welcome!


## License

This software is distributed under the [Apache License](https://raw.githubusercontent.com/KensoBI/spc-chart/main/LICENSE).


## Notes

Copyright (c) 2024 [Kenso Software](https://kensobi.com)