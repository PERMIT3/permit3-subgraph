import { BigInt, Bytes, Felt } from "@starknet-graph/graph-ts";
import {
  DidSetPermit as DidSetPermitEvent,
  DidConsumePermit as DidConsumePermitEvent,
} from "../generated/Permit3/Permit3";
import { Permit, PermitEvent, User, Global } from "../generated/schema";

function getAndIncrementGlobalCounter(): Bytes {
  let entity = Global.load("GLOBAL_ID");
  if (entity === null) {
    entity = new Global("GLOBAL_ID");
    entity.counter = 0;
  }
  entity.counter++;
  entity.save();
  return Bytes.fromI32(entity.counter);
}

function updateUserEntity(
  id: Bytes,
  asFrom: i32,
  asOperator: i32,
  asContract: i32
): void {
  let entity = User.load(id);
  if (entity == null) {
    entity = new User(id);
  }
  entity.asFrom += asFrom;
  entity.asOperator += asOperator;
  entity.asContract += asContract;
  entity.save();
}

export function handleDidSetPermit(event: DidSetPermitEvent): void {
  const from = event.data[0];
  const operator = event.data[1];
  const contract = event.data[2];
  const rights = event.data[3];
  const numberOfPermits = changetype<Felt>(event.data[4]).intoBigInt();

  const eventEntityId = event.transaction.hash.concat(
    getAndIncrementGlobalCounter()
  );
  const permitEntityId = from.concat(operator.concat(contract.concat(rights)));

  let eventEntity = new PermitEvent(eventEntityId);
  eventEntity.type = "DidSetPermit";
  eventEntity.timestamp = event.block.timestamp;
  eventEntity.transactionHash = event.transaction.hash;
  eventEntity.permit = permitEntityId;

  let permitEntity = Permit.load(permitEntityId);
  if (permitEntity == null) {
    permitEntity = new Permit(permitEntityId);
    permitEntity.creationTimestamp = event.block.timestamp;
    permitEntity.creationTransactionHash = event.transaction.hash;
    permitEntity.from = from;
    permitEntity.operator = operator;
    permitEntity.contract = contract;
    permitEntity.rights = rights.toHexString();
    permitEntity.number = BigInt.fromI32(0);
  }
  if (permitEntity.number.equals(BigInt.fromI32(0))) {
    updateUserEntity(from, 1, 0, 0);
    updateUserEntity(operator, 0, 1, 0);
    updateUserEntity(contract, 0, 0, 1);
  }
  permitEntity.number = numberOfPermits;
  permitEntity.save();
  eventEntity.save();
}

export function handleDidConsumePermit(event: DidConsumePermitEvent): void {
  const from = event.data[0];
  const operator = event.data[1];
  const contract = event.data[2];
  const rights = event.data[3];

  const eventEntityId = event.transaction.hash.concat(
    getAndIncrementGlobalCounter()
  );
  const permitEntityId = from.concat(operator.concat(contract.concat(rights)));

  let eventEntity = new PermitEvent(eventEntityId);
  eventEntity.type = "DidConsumePermit";
  eventEntity.timestamp = event.block.timestamp;
  eventEntity.transactionHash = event.transaction.hash;
  eventEntity.permit = permitEntityId;
  eventEntity.save();

  let permitEntity = Permit.load(permitEntityId)!;
  permitEntity.number = permitEntity.number.minus(BigInt.fromI32(1));
  if (permitEntity.number.equals(BigInt.fromI32(0))) {
    updateUserEntity(from, -1, 0, 0);
    updateUserEntity(operator, 0, -1, 0);
    updateUserEntity(contract, 0, 0, -1);
  }
  permitEntity.save();
}
