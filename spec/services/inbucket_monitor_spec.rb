require "rails_helper"

RSpec.describe InbucketMonitor do
  it "saves the mailbox from a stored-message monitor event" do
    described_class.record({ variant: "message-stored", header: { mailbox: "start9-edge" } }.to_json)

    expect(Mailbox.find_by(name: "start9-edge")&.name).to eq("start9-edge")
    expect(MonitorMessage.find_by(mailbox: "start9-edge")&.message_id).to be_nil
  end

  it "does not save a mailbox from another monitor event" do
    described_class.record({ variant: "message-deleted", header: { mailbox: "start9-edge" } }.to_json)

    expect(Mailbox.find_by(name: "start9-edge")).to be_nil
  end

  it "does not restore an archived mailbox from a stored-message event" do
    Mailbox.record("start9-edge").update!(archived: true)

    described_class.record({ variant: "message-stored", header: { mailbox: "start9-edge" } }.to_json)

    expect(Mailbox.find_by(name: "start9-edge")&.archived?).to be(true)
  end

  it "stores a monitor message summary when the event includes an identifier" do
    payload = {
      variant: "message-stored",
      header: { mailbox: "start9-edge", id: "20260813T120000-0001", subject: "Alert" }
    }
    described_class.record(payload.to_json)

    monitor_message = MonitorMessage.find_by(mailbox: "start9-edge", message_id: "20260813T120000-0001")

    expect(monitor_message&.header).to include("subject" => "Alert")
  end

  it "keeps running when Inbucket repeats a stored-message event" do
    payload = { variant: "message-stored", header: { mailbox: "start9-edge" } }.to_json

    described_class.record(payload)
    described_class.record(payload)

    expect(Mailbox.where(name: "start9-edge").count).to eq(1)
  end
end
