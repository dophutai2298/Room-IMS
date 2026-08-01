# Room Management Context

Core domain language for the Rental Room Management (Quản lý Phòng Trọ) system.

## Roles

**Landlord**:
The property owner or primary administrator who has full access to the web app.
_Avoid_: Admin, Owner, Chủ nhà (in code)

**Staff**:
An employee who helps operate the rental property (e.g., collecting metrics, creating invoices) but may have restricted permissions compared to the Landlord.
_Avoid_: Operator, Manager, Nhân viên (in code)

**Tenant**:
A person living in a rental room. They do not log into the web app in the MVP.
_Avoid_: Resident, Customer, Cư dân (in code)

**Key Tenant**:
The specific Tenant who signs the contract, is responsible for paying invoices, and acts as the primary contact for a room.
_Avoid_: Representative, Đại diện phòng (in code)

## Core Concepts

**Room**:
A physical rental unit. Its base state is defined by its configuration and properties.

**Room Status**:
A computed state representing the room's availability. It is 'Occupied' if there is an active Contract, and 'Available' otherwise. 'Maintenance' is a manual override flag on the Room itself.

**Utility Metrics**:
The monthly readings for electricity and water consumption for a Room. It is recorded by Staff or Landlord.

**Utility Pricing**:
The unit cost for utilities (e.g., per kWh, per m3). It is configured globally for the property but can be overridden at the Contract level.

**Invoice**:
The final bill generated at the end of a billing cycle (usually monthly). It is calculated automatically by combining the Room's base rent from the Contract and the usage calculated from Utility Metrics against the applicable Utility Pricing.


