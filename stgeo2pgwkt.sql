##The code below returns the SDE features stored as st_geometry in a shape field in the VT State Plane coordinate system (SRID 32145) as text in Well-Known Text representation in Web Mercator, so that they can be displayed in the from end User Interface

DROP FUNCTION public.getfieldpolygons();
CREATE OR REPLACE FUNCTION public.getfieldpolygons()
RETURNS TABLE (fieldid integer, shape st_geometry, sdetext text,pggeom geometry, pggeom_webmerc geometry, polyaswkt text) AS
$BODY$
--THIS FUNCTION TAKES AN SDE FEATURE CLASS IN VT STATE PLANE AND RETURNS WKT IN WEB MERCATOR
--THIS FUNCTION ASSUMES YOU HAVE AN SDE FEATURE CLASS NAMED FIELDS WITH AN OBJECTID COLUMN AND A SHAPE COLUMN IN THE SDE SCHEMA
--EACH COLUMN RETURN ADDS AN ADDITIONAL TRANFORMATION STEP
BEGIN

RETURN QUERY

SELECT
a.objectid,
a.shape, --sde st_geometry format
sde.st_astext(a.shape)::text as sdetext, --sde function to convert shape to text, no srid, returns cstring
sde.public.st_geomfromtext(sde.st_astext(a.shape)::text,32145) as pggeom, --postgis function st_geomfromtext converts text to geometry and assigns SRID for VT State Plane
sde.public.st_transform(sde.public.st_geomfromtext(sde.st_astext(a.shape)::text,32145),3857) as pggeom_webmerc, --postgis function st_transform transforms geometry from VT State Plane to Web Mercator (SRID 3857)
sde.public.st_astext(sde.public.st_transform(sde.public.st_geomfromtext(sde.st_astext(a.shape)::text,32145),3857)) as polyaswkt --postgis function st_astext converts postgis geometry in Web Mercator to WKT for display on front end
FROM ag.fc_farm_poly a;



END;

$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100
  ROWS 1000;
ALTER FUNCTION public.getfieldpolygons()
  OWNER TO sde;