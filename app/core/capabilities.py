import enum

from app.models.enums import BusinessModel


class Capability(str, enum.Enum):
    inventory = "inventory"
    services = "services"


CAPABILITIES: dict[BusinessModel, frozenset[Capability]] = {
    BusinessModel.stock: frozenset({Capability.inventory}),
    BusinessModel.service: frozenset({Capability.services}),
    BusinessModel.hybrid: frozenset({Capability.inventory, Capability.services}),
}


def has_capability(model: BusinessModel, capability: Capability) -> bool:
    return capability in CAPABILITIES[model]
