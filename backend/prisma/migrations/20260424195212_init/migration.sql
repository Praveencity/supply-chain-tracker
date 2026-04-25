-- CreateTable
CREATE TABLE "Carrier" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "contact_info" TEXT,
    "rating" DOUBLE PRECISION,

    CONSTRAINT "Carrier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipments" (
    "id" SERIAL NOT NULL,
    "priority_level" TEXT NOT NULL,
    "cargo_type" TEXT NOT NULL,
    "carrier_id" INTEGER NOT NULL,
    "estimated_arrival_at_creation" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',

    CONSTRAINT "Shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Telemetry_Logs" (
    "id" SERIAL NOT NULL,
    "shipment_id" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "long" DOUBLE PRECISION NOT NULL,
    "speed" DOUBLE PRECISION,
    "temperature" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Telemetry_Logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Geofences" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "center_lat" DOUBLE PRECISION NOT NULL,
    "center_long" DOUBLE PRECISION NOT NULL,
    "radius_km" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Geofences_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Shipments" ADD CONSTRAINT "Shipments_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "Carrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Telemetry_Logs" ADD CONSTRAINT "Telemetry_Logs_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "Shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
