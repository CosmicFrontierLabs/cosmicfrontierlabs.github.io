---
title: "Spacecraft Bus Provider Downselect Complete"
date: 2025-12-18
category: "Engineering"
---

We've completed our spacecraft bus provider downselect, a critical decision that shapes nearly every aspect of our demonstration mission. After months of detailed evaluation across multiple candidates, we've selected a partner to provide the spacecraft platform that will carry our telescope to orbit.

## Why the Bus Matters

The spacecraft bus is everything that isn't the telescope: power generation, attitude control, communications, propulsion, and the structure that holds it all together. For a precision astronomical instrument, the bus isn't just a carrier—it's a critical subsystem that directly determines what science we can do.

Unlike Earth-imaging satellites that take snapshots in milliseconds, space telescopes need to stare at faint objects for minutes at a time. Every wobble, every vibration from a reaction wheel, every thermal flex shows up in our data. The bus we selected had to meet demanding requirements that most commercial platforms aren't designed for.

## Our Evaluation Framework

We developed a comprehensive evaluation framework based on eight guiding principles that reflect our mission objectives and long-term strategy:

### 1. Observation Impact

We measure observatory productivity using a metric we call Observation Impact—relating collecting area, resolution, and observing time to reflect the science output an observatory can deliver. This means evaluating not just whether a bus meets specifications, but how it enables or constrains the observations we can make.

### 2. Threshold Capability Requirements

Rather than optimizing for a single metric, we developed threshold requirements across multiple dimensions: pointing stability, bandpass flexibility, field of regard, photometric stability, and integration time limits. A bus that excels in one area but fails another doesn't serve our science goals.

### 3. Launch Cadence Security

The demonstration mission is the first of many missions. We prioritized vendors who could reliably deliver on schedule and scale with us over time. A provider with the best specifications but uncertain delivery timelines creates unacceptable program risk.

### 4. Standardized Instrument Interface

We're developing a standardized interface for our telescope payloads. We evaluated how well each bus could accommodate our interface requirements for mass, power, thermal control, electromagnetic compatibility, and radiation shielding.

### 5. Leveraging External Investment

We sought platforms receiving significant commercial investment from other customers. Buses purpose-built for a single mission carry development risk; platforms with broad customer bases benefit from continuous improvement and cost reduction.

### 6. Core Competency Development

Where our requirements diverge from other industries, we're prepared to bring capabilities in-house. We evaluated how much unique work each bus would require from us versus from the vendor, and whether that division made strategic sense.

### 7. Lowering Barriers to Iteration

Spacecraft development traditionally follows a "get it right the first time" mentality. We prefer platforms that enable rapid learning and correction—both during development and through follow-on missions.

### 8. Selected Complexities

When faced with overconstraint, we invest in carefully-selected complexity. We evaluated what payload-side systems (fine steering mirrors, vibration isolation, custom thermal solutions) each bus would require us to develop.

## Technical Requirements

Our Request for Proposals specified demanding performance requirements across several categories:

**Pointing Performance** — We specified tight requirements for both absolute pointing error and relative pointing error over long exposure durations, along with minimum slew rates for efficient target acquisition. These requirements aren't arbitrary—they're derived from our detector pixel size, optical design, and the integration times our science demands. Pointing errors that exceed a fraction of a pixel blur our images and limit the faint sources we can detect. The relative pointing error requirement is particularly challenging—most commercial buses are designed for Earth observation where exposures last milliseconds, not the minutes our science requires.

**Power and Data** — Our telescope generates substantial data volumes, and our sensors require significant power for cooling. We specified orbit-average power, peak power, and data throughput requirements with comfortable margins above our current best estimates.

**Mass and Volume** — We specified payload mass capacity and volume constraints compatible with rideshare launch opportunities.

**Mission Constraints** — We required a minimum mission lifetime, compatibility with our launch timeline, and special geometric considerations including the angle between solar array normal and telescope boresight, structure clearance around the telescope aperture, and star tracker orientations supporting long-duration inertial pointing.

## Key Tradeoffs

### Pointing Stability vs. Heritage

Our most heavily weighted criterion was pointing stability—specifically, the combination of attitude control system drift and high-frequency jitter. We evaluated native bus stability, reaction wheel characteristics, the availability of fine-balanced wheels, and each provider's experience with precision pointing applications.

Some candidates offered extensive flight heritage with dozens of successful missions, but their attitude control systems were designed for applications less demanding than precision astronomy. Others offered newer platforms with better alignment to our needs but less on-orbit validation.

We also evaluated each provider's ability to incorporate payload feedback—using our fine guidance sensor to close the loop on attitude control at rates faster than the bus's native star trackers. This capability varies significantly between platforms and represents a key differentiator for our application.

### Cost vs. Capability vs. Risk

Total mission cost varied substantially between candidates. But headline cost doesn't capture schedule risk, integration complexity, or the payload-side systems each bus would require us to develop.

A lower-cost bus that requires us to develop more payload complexity isn't necessarily cheaper. A higher-cost bus that absorbs complexity we'd otherwise own might be the better value. We modeled total program cost including our own development work, not just the procurement price.

### Scaling for the Future

The demonstration mission is our first mission, not our last. We evaluated each provider's:

- **Quantity scaling**: Factory capacity and production rate capabilities for constellation-scale operations
- **Aperture scaling**: Ability to accommodate larger telescopes as we grow our aperture over time
- **Facility constraints**: Ceiling heights, cleanroom capacity, and expansion plans
- **Business model alignment**: Whether our growth path aligns with their strategic direction

Some providers are optimized for high-volume production of standardized buses. Others offer more customization but less scaling potential. We needed a partner who could grow with us.

### Operations Model Alignment

Space telescopes require operational flexibility that not all providers can accommodate. We need to:

- Schedule observations based on astronomical targets, not ground station passes
- Respond to targets of opportunity on short timescales
- Access detailed spacecraft telemetry for calibration and anomaly resolution
- Maintain insight into attitude control algorithms for pointing reconstruction

Some providers operate spacecraft as a service, delivering data products rather than spacecraft access. While this model works well for some applications, it creates friction for observatory operations. We prioritized providers whose operations model gives us the flexibility astronomical observations demand.

## The Demonstration Mission Context

Our spacecraft selection serves the broader objectives of the demonstration mission:

**Technical Demonstration**: Validate our fine-guidance and jitter control system, achieving diffraction-limited imaging over long integrations. Demonstrate telescope architecture that scales in aperture and quantity. Prove integration with a commercial bus requiring minimal engineering changes.

**Programmatic Demonstration**: Deliver science-quality data products to the astronomical community and incorporate feedback into our full-scale mission planning.

**Scientific Impact**: Validate demand for accessible space telescope time and engage with the scientific community to anchor our operational model.

The bus we selected supports all three objectives—not just meeting technical specifications, but enabling the operational concept our demonstration requires.

## What Made the Difference

Every provider we evaluated brought genuine strengths. Some had unmatched flight heritage. Others offered better native alignment with our pointing requirements. Some provided exceptional value on a pure cost basis.

The final decision came down to partnership. We needed a provider who:

- Understood that our requirements aren't arbitrary—they're driven by physics
- Was willing to work through technical challenges collaboratively
- Could provide visibility into spacecraft systems we need for calibration and operations
- Aligned with our timeline and could credibly deliver on schedule
- Shared our excitement about building something new

We found that partner.

## What's Next

With our bus provider selected, we move into the detailed design phase. Our teams are already working together on interface definitions, thermal analysis, and integration planning.

Meanwhile, the rest of our program continues to advance:

- Our [Zerodur mirror blanks](/blog/zerodur-mirror-blanks-complete) are with our optical integration partner for grinding and polishing
- [Mass simulator parts](/blog/first-parts-received-for-mass-simulator) are arriving for assembly process validation
- Our [launch slot for Q4 2027](/blog/launch-booked-for-q4-2027) gives us a firm timeline to execute against

The architecture is set. The team is assembled. Now we build the first in a new generation of space telescopes.
