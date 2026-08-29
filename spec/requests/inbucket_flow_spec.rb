require "rails_helper"

RSpec.describe "Inbucket flow", type: :request do
  let(:mailbox) { "candidate" }
  let(:message_id) { "20260811T120000-0001" }
  let(:messages) do
    [
      {
        mailbox: mailbox,
        id: message_id,
        from: "sender@example.com",
        subject: "Hello",
        date: "2026-08-11T12:00:00Z",
        size: 512,
        seen: false
      }
    ]
  end
  let(:message) do
    {
      mailbox: mailbox,
      id: message_id,
      from: "sender@example.com",
      subject: "Hello",
      body: { text: "Welcome", html: "<p>Welcome</p>" },
      header: { To: ["candidate@example.com"] },
      attachments: []
    }
  end
  let(:monitor_header) do
    {
      "mailbox" => mailbox,
      "id" => message_id,
      "subject" => "Hello",
      "date" => "2026-08-11T12:00:00Z"
    }
  end

  it "requires a private session" do
    get "/v1/inbucket/mailboxes/#{mailbox}"

    expect(response).to have_http_status(:unauthorized)
    expect(response.parsed_body).to eq("error" => "unauthorized")
  end

  it "requires a private session for attachment downloads" do
    get "/v1/inbucket/mailboxes/#{mailbox}/messages/#{message_id}/attachments/0"

    expect(response).to have_http_status(:unauthorized)
    expect(response.parsed_body).to eq("error" => "unauthorized")
  end

  it "returns upstream message headers with their seen state" do
    authenticate
    stub_json("/api/v1/mailbox/#{mailbox}", messages)

    get "/v1/inbucket/mailbox", params: { name: mailbox }

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to eq(JSON.parse(messages.to_json))
    expect(response.headers["Cache-Control"]).to eq("private, no-store")
  end

  it "returns a seen upstream message without a duplicate read field" do
    authenticate
    stub_json("/api/v1/mailbox/#{mailbox}", [{ **messages.first, seen: true }])

    get "/v1/inbucket/mailboxes/#{mailbox}"

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body.first).to include("seen" => true)
    expect(response.parsed_body.first).not_to have_key("read")
  end

  it "does not add state when upstream omits seen" do
    authenticate
    stub_json("/api/v1/mailbox/#{mailbox}", [messages.first.except(:seen)])

    get "/v1/inbucket/mailboxes/#{mailbox}"

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body.first).not_to have_key("seen")
    expect(response.parsed_body.first).not_to have_key("read")
  end

  it "preserves a malformed upstream seen value without adding state" do
    authenticate
    stub_json("/api/v1/mailbox/#{mailbox}", [{ **messages.first, seen: "true" }])

    get "/v1/inbucket/mailboxes/#{mailbox}"

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body.first).to include("seen" => "true")
    expect(response.parsed_body.first).not_to have_key("read")
  end

  it "marks a message seen through the upstream API" do
    authenticate
    stub_request(:patch, "http://inbucket.test:9000/api/v1/mailbox/#{mailbox}/#{message_id}")
      .with(
        body: '{"seen":true}',
        headers: { "Accept" => "application/json", "Content-Type" => "application/json" }
      )
      .to_return(status: 204, body: "")

    patch "/v1/inbucket/mailboxes/#{mailbox}/messages/#{message_id}/read"

    expect(response).to have_http_status(:no_content)
  end

  it "escapes mailbox and message identifiers when marking a message seen" do
    authenticate
    stub_request(:patch, "http://inbucket.test:9000/api/v1/mailbox/candidate%2Balerts/message%2B1")
      .with(
        body: '{"seen":true}',
        headers: { "Accept" => "application/json", "Content-Type" => "application/json" }
      )
      .to_return(status: 204, body: "")

    patch "/v1/inbucket/mailboxes/candidate%2Balerts/messages/message%2B1/read"

    expect(response).to have_http_status(:no_content)
  end

  it "marks a message read idempotently" do
    authenticate
    stub_request(:patch, "http://inbucket.test:9000/api/v1/mailbox/#{mailbox}/#{message_id}")
      .with(body: '{"seen":true}')
      .to_return(status: 204, body: "")

    2.times do
      patch "/v1/inbucket/mailboxes/#{mailbox}/messages/#{message_id}/read"
      expect(response).to have_http_status(:no_content)
    end
  end

  it "returns not found when marking a missing message read" do
    authenticate
    stub_request(:patch, "http://inbucket.test:9000/api/v1/mailbox/#{mailbox}/missing")
      .with(body: '{"seen":true}')
      .to_return(status: 404, body: "not found")

    patch "/v1/inbucket/mailboxes/#{mailbox}/messages/missing/read"

    expect(response).to have_http_status(:not_found)
    expect(response.parsed_body).to eq("error" => "not_found")
  end

  it "does not report read success when upstream rejects the change" do
    authenticate
    stub_request(:patch, "http://inbucket.test:9000/api/v1/mailbox/#{mailbox}/#{message_id}")
      .with(body: '{"seen":true}')
      .to_return(status: 500, body: "failed")

    patch "/v1/inbucket/mailboxes/#{mailbox}/messages/#{message_id}/read"

    expect(response).to have_http_status(:bad_gateway)
    expect(response.parsed_body).to eq("error" => "inbucket_error")
  end

  it "saves a mailbox after it is confirmed to contain messages" do
    authenticate
    stub_json("/api/v1/mailbox/#{mailbox}", messages)

    get "/v1/inbucket/mailboxes/#{mailbox}"

    expect(response).to have_http_status(:ok)
    expect(Mailbox.find_by(name: mailbox)&.name).to eq(mailbox)
  end

  it "does not save an empty mailbox" do
    authenticate
    stub_json("/api/v1/mailbox/#{mailbox}", [])

    get "/v1/inbucket/mailboxes/#{mailbox}"

    expect(response).to have_http_status(:ok)
    expect(Mailbox.find_by(name: mailbox)).to be_nil
  end

  it "returns saved mailboxes" do
    authenticate
    Mailbox.record("alerts")
    Mailbox.record("candidate")

    get "/v1/inbucket/mailboxes"

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to eq(%w[alerts candidate])
  end

  it "returns archived mailboxes separately" do
    Mailbox.record("alerts").update!(archived: true)
    Mailbox.record("candidate")
    authenticate
    stub_json("/api/v1/mailbox/alerts", [])

    get "/v1/inbucket/mailboxes", params: { archived: true }

    expect(response.parsed_body).to eq([{ "name" => "alerts", "message_count" => 0 }])
  end

  it "returns recent monitor message summaries with current upstream seen state" do
    authenticate
    MonitorMessage.record(monitor_header)
    unread_header = monitor_header.merge("id" => "20260811T120000-0002", "subject" => "Unread alert")
    MonitorMessage.record(unread_header)
    stub_json(
      "/api/v1/mailbox/#{mailbox}",
      [
        { id: message_id, seen: true },
        { id: unread_header.fetch("id"), seen: false }
      ]
    )

    get "/v1/inbucket/monitor/messages"

    expect(response).to have_http_status(:ok)
    messages_by_id = response.parsed_body.index_by { |message| message.fetch("id") }
    expect(messages_by_id.fetch(message_id)).to include(monitor_header.merge("seen" => true))
    expect(messages_by_id.fetch(unread_header.fetch("id"))).to include(unread_header.merge("seen" => false))
  end

  it "does not return false monitor seen indicators when upstream fails" do
    authenticate
    MonitorMessage.record(monitor_header)
    stub_request(:get, "http://inbucket.test:9000/api/v1/mailbox/#{mailbox}")
      .to_return(status: 500, body: "failed")

    get "/v1/inbucket/monitor/messages"

    expect(response).to have_http_status(:bad_gateway)
    expect(response.parsed_body).to eq("error" => "inbucket_error")
  end

  it "archives a saved mailbox without purging its messages" do
    authenticate
    Mailbox.record(mailbox)

    patch "/v1/inbucket/mailbox/archive", params: { name: mailbox }

    expect(response).to have_http_status(:no_content)
    expect(Mailbox.find_by(name: mailbox)&.archived?).to be(true)
  end

  it "restores an archived mailbox when it is opened" do
    authenticate
    Mailbox.record(mailbox).update!(archived: true)
    stub_json("/api/v1/mailbox/#{mailbox}", messages)

    get "/v1/inbucket/mailbox", params: { name: mailbox }

    expect(response).to have_http_status(:ok)
    expect(Mailbox.find_by(name: mailbox)&.archived?).to be(false)
  end

  it "returns a parsed message" do
    authenticate
    stub_json("/api/v1/mailbox/#{mailbox}/#{message_id}", message)

    get "/v1/inbucket/mailboxes/#{mailbox}/messages/#{message_id}"

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to eq(JSON.parse(message.to_json))
  end

  it "returns message source as plain text" do
    authenticate
    source = "From: sender@example.com\r\nSubject: Hello\r\n\r\nWelcome"
    stub_request(:get, "http://inbucket.test:9000/api/v1/mailbox/#{mailbox}/#{message_id}/source")
      .to_return(status: 200, body: source, headers: { "Content-Type" => "text/plain" })

    get "/v1/inbucket/mailboxes/#{mailbox}/messages/#{message_id}/source"

    expect(response).to have_http_status(:ok)
    expect(response.media_type).to eq("text/plain")
    expect(response.body).to eq(source)
  end

  it "returns a matching inline image from the message source" do
    authenticate
    source = <<~MESSAGE
      Content-Type: multipart/related; boundary="part"

      --part
      Content-Type: text/html

      <img src="cid:logo-gray.png">
      --part
      Content-Type: image/png
      Content-ID: <logo-gray.png>
      Content-Transfer-Encoding: base64

      aGVsbG8=
      --part--
    MESSAGE
    stub_request(:get, "http://inbucket.test:9000/api/v1/mailbox/#{mailbox}/#{message_id}/source")
      .to_return(status: 200, body: source, headers: { "Content-Type" => "text/plain" })

    get "/v1/inbucket/mailboxes/#{mailbox}/messages/#{message_id}/inline-image", params: { cid: "logo-gray.png" }

    expect(response).to have_http_status(:ok)
    expect(response.media_type).to eq("image/png")
    expect(response.body).to eq("hello")
  end

  it "matches a URL-encoded content ID without case sensitivity" do
    authenticate
    source = <<~MESSAGE
      Content-Type: multipart/related; boundary="part"

      --part
      Content-Type: text/html

      <img src="cid:Logo One.PNG">
      --part
      Content-Type: image/png
      Content-ID: <Logo One.PNG>
      Content-Transfer-Encoding: base64

      aGVsbG8=
      --part--
    MESSAGE
    stub_request(:get, "http://inbucket.test:9000/api/v1/mailbox/#{mailbox}/#{message_id}/source")
      .to_return(status: 200, body: source, headers: { "Content-Type" => "text/plain" })

    get "/v1/inbucket/mailboxes/#{mailbox}/messages/#{message_id}/inline-image?cid=logo%20one.png"

    expect(response).to have_http_status(:ok)
    expect(response.media_type).to eq("image/png")
    expect(response.body).to eq("hello")
  end

  it "returns a matching BMP inline image" do
    authenticate
    source = <<~MESSAGE
      Content-Type: multipart/related; boundary="part"

      --part
      Content-Type: text/html

      <img src="cid:purchase-code">
      --part
      Content-Type: image/bmp
      Content-ID: <purchase-code>
      Content-Transfer-Encoding: base64

      Qk0=
      --part--
    MESSAGE
    stub_request(:get, "http://inbucket.test:9000/api/v1/mailbox/#{mailbox}/#{message_id}/source")
      .to_return(status: 200, body: source, headers: { "Content-Type" => "text/plain" })

    get "/v1/inbucket/mailboxes/#{mailbox}/messages/#{message_id}/inline-image", params: { cid: "purchase-code" }

    expect(response).to have_http_status(:ok)
    expect(response.media_type).to eq("image/bmp")
    expect(response.body).to eq("BM")
  end

  it "does not expose a non-image content ID" do
    authenticate
    source = <<~MESSAGE
      Content-Type: multipart/related; boundary="part"

      --part
      Content-Type: text/html

      <img src="cid:document">
      --part
      Content-Type: text/html
      Content-ID: <document>

      <script>alert('unsafe')</script>
      --part--
    MESSAGE
    stub_request(:get, "http://inbucket.test:9000/api/v1/mailbox/#{mailbox}/#{message_id}/source")
      .to_return(status: 200, body: source, headers: { "Content-Type" => "text/plain" })

    get "/v1/inbucket/mailboxes/#{mailbox}/messages/#{message_id}/inline-image", params: { cid: "document" }

    expect(response).to have_http_status(:not_found)
  end

  it "does not expose an SVG content ID" do
    authenticate
    source = <<~MESSAGE
      Content-Type: multipart/related; boundary="part"

      --part
      Content-Type: text/html

      <img src="cid:vector">
      --part
      Content-Type: image/svg+xml
      Content-ID: <vector>

      <svg xmlns="http://www.w3.org/2000/svg"><script>alert('unsafe')</script></svg>
      --part--
    MESSAGE
    stub_request(:get, "http://inbucket.test:9000/api/v1/mailbox/#{mailbox}/#{message_id}/source")
      .to_return(status: 200, body: source, headers: { "Content-Type" => "text/plain" })

    get "/v1/inbucket/mailboxes/#{mailbox}/messages/#{message_id}/inline-image", params: { cid: "vector" }

    expect(response).to have_http_status(:not_found)
  end

  it "lists message attachments" do
    authenticate
    source = attachment_source
    stub_request(:get, "http://inbucket.test:9000/api/v1/mailbox/#{mailbox}/#{message_id}/source")
      .to_return(status: 200, body: source, headers: { "Content-Type" => "text/plain" })

    get "/v1/inbucket/mailboxes/#{mailbox}/messages/#{message_id}/attachments"

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to eq([{ "index" => 0, "filename" => "resume.pdf", "content_type" => "application/pdf", "size" => 5 }])
  end

  it "downloads a message attachment instead of rendering it" do
    authenticate
    stub_request(:get, "http://inbucket.test:9000/api/v1/mailbox/#{mailbox}/#{message_id}/source")
      .to_return(status: 200, body: attachment_source, headers: { "Content-Type" => "text/plain" })

    get "/v1/inbucket/mailboxes/#{mailbox}/messages/#{message_id}/attachments/0"

    expect(response).to have_http_status(:ok)
    expect(response.media_type).to eq("application/pdf")
    expect(response.headers["Content-Disposition"]).to include("attachment")
    expect(response.headers["X-Content-Type-Options"]).to eq("nosniff")
    expect(response.body).to eq("hello")
  end

  it "does not download an attachment index that is not present" do
    authenticate
    stub_request(:get, "http://inbucket.test:9000/api/v1/mailbox/#{mailbox}/#{message_id}/source")
      .to_return(status: 200, body: attachment_source, headers: { "Content-Type" => "text/plain" })

    get "/v1/inbucket/mailboxes/#{mailbox}/messages/#{message_id}/attachments/1"

    expect(response).to have_http_status(:not_found)
  end

  it "deletes a message" do
    authenticate
    MonitorMessage.record(monitor_header)
    stub_request(:delete, "http://inbucket.test:9000/api/v1/mailbox/#{mailbox}/#{message_id}")
      .to_return(status: 200, body: '"OK"', headers: { "Content-Type" => "application/json" })

    delete "/v1/inbucket/message", params: { name: mailbox, id: message_id }

    expect(response).to have_http_status(:no_content)
    expect(MonitorMessage.find_by(mailbox:, message_id:)).to be_nil
  end

  it "purges a mailbox and removes it from saved mailboxes" do
    authenticate
    Mailbox.record(mailbox)
    MonitorMessage.record(monitor_header)
    stub_request(:delete, "http://inbucket.test:9000/api/v1/mailbox/#{mailbox}")
      .to_return(status: 200, body: '"OK"', headers: { "Content-Type" => "application/json" })

    delete "/v1/inbucket/mailbox", params: { name: mailbox }

    expect(response).to have_http_status(:no_content)
    expect(Mailbox.find_by(name: mailbox)).to be_nil
    expect(MonitorMessage.find_by(mailbox:)).to be_nil
  end

  it "returns not found when Inbucket cannot find a message" do
    authenticate
    stub_request(:get, "http://inbucket.test:9000/api/v1/mailbox/#{mailbox}/missing")
      .to_return(status: 404, body: "not found")

    get "/v1/inbucket/mailboxes/#{mailbox}/messages/missing"

    expect(response).to have_http_status(:not_found)
    expect(response.parsed_body).to eq("error" => "not_found")
  end

  it "reports an unavailable Inbucket service" do
    authenticate
    stub_request(:get, "http://inbucket.test:9000/api/v1/mailbox/#{mailbox}").to_timeout

    get "/v1/inbucket/mailboxes/#{mailbox}"

    expect(response).to have_http_status(:bad_gateway)
    expect(response.parsed_body).to eq("error" => "inbucket_unavailable")
  end

  def authenticate
    user = User.create!(username: "admin", password: "correct horse battery staple")
    post "/v1/session",
         params: { username: user.username, password: "correct horse battery staple" }.to_json,
         headers: json_headers
    expect(response).to have_http_status(:ok)
    user
  end

  def json_headers
    {
      "CONTENT_TYPE" => "application/json"
    }
  end

  def stub_json(path, body)
    stub_request(:get, "http://inbucket.test:9000#{path}")
      .to_return(status: 200, body: body.to_json, headers: { "Content-Type" => "application/json" })
  end

  def attachment_source
    <<~MESSAGE
      Content-Type: multipart/mixed; boundary="part"

      --part
      Content-Type: text/plain

      Welcome
      --part
      Content-Type: application/pdf; name="resume.pdf"
      Content-Disposition: attachment; filename="resume.pdf"
      Content-Transfer-Encoding: base64

      aGVsbG8=
      --part--
    MESSAGE
  end
end
