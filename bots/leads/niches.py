"""Nicho -> filtros do OpenStreetMap. Adicionar um nicho é só acrescentar uma linha."""
NICHES = {
    "barbearia": ('"shop"~"hairdresser|barber"',),
    "salao": ('"shop"~"hairdresser|beauty"',),
    "clinica": ('"amenity"~"clinic|doctors|dentist"',),
    "restaurante": ('"amenity"~"restaurant|fast_food|cafe"',),
    "academia": ('"leisure"="fitness_centre"',),
    "petshop": ('"shop"="pet"',),
    "loja_roupas": ('"shop"="clothes"',),
}
